<!-- <template>
  <div class="call-page">
    <VideoCall :call-link="callLink" />
    <CallInterface :call-link="callLink" @start-call="startCall" @hang-up="hangUp" />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import VideoCall from '../components/VideoCall.vue'
import CallInterface from '../components/CallInterface.vue'

export default {
  name: 'Call',
  components: {
    VideoCall,
    CallInterface
  },
  setup() {
    const callLink = ref('')

    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }

    const generateCallLink = () => {
      const baseUrl = 'https://nofelet.duckdns.org/call/'
      callLink.value = baseUrl + generateUUID()
    }

    const startCall = () => {
      console.log('Starting call...')
    }

    const hangUp = () => {
      console.log('Hanging up...')
    }

    onMounted(() => {
      generateCallLink()
    })

    return {
      callLink,
      startCall,
      hangUp
    }
  }
}
</script>

<style scoped>
.call-page {
  min-height: calc(100vh - 120px);
  padding: 0;
}
</style> -->



<template>
  <div class="call-container">
    <h1>WebRTC Video Call</h1>

    <div class="status" :class="statusClass">{{ statusMessage }}</div>

    <div class="buttons">
      <button @click="startCall" :disabled="!connected || calling">Start Call</button>
      <button @click="hangUp" :disabled="!calling">Hang Up</button>
    </div>

    <div class="video-container">
      <div class="video-box">
        <h3>Local Video</h3>
        <video ref="localVideo" autoplay muted playsinline></video>
      </div>
      <div class="video-box">
        <h3>Remote Video</h3>
        <video ref="remoteVideo" autoplay playsinline></video>
      </div>
    </div>

    <div class="messages">
      <h3>Debug Log</h3>
      <div class="log-window">
        <div v-for="(msg, idx) in logMessages" :key="idx">{{ msg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

// === STATE ===
const ws = ref(null)
const uuid = crypto.randomUUID()
const connected = ref(false)
const calling = ref(false)
const statusMessage = ref('Disconnected')
const statusClass = ref('disconnected')
const logMessages = ref([])

const localVideo = ref(null)
const remoteVideo = ref(null)

let peerConnection = null
let localStream = null
let remoteStream = null
let iceCandidatesQueue = []

// === ICE CONFIGURATION ===
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
}

// === LOGGING ===
function addLog(msg) {
  const timestamp = new Date().toLocaleTimeString()
  const line = `[${timestamp}] ${msg}`
  console.log('%c[WebRTC]', 'color: #0af', msg)
  logMessages.value.push(line)
  if (logMessages.value.length > 500) logMessages.value.shift()
}

function updateStatus(message, type) {
  statusMessage.value = message
  statusClass.value = type
  addLog(`STATUS → ${message}`)
}

// === CONNECT TO SIGNALING SERVER ===
function connectWS() {
  try {
    const url = `wss://nofelet.duckdns.org:8443/connect/${uuid}`
    addLog(`Connecting to signaling server: ${url}`)
    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      connected.value = true
      updateStatus('Connected to signaling server ✅', 'connected')
    }

    ws.value.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      addLog(`Received: ${msg.type}`)

      if (msg.type === 'answer') {
        await handleAnswer(msg)
      } else if (msg.type === 'ice-candidate') {
        await handleIceCandidate(msg.candidate)
      }
    }

    ws.value.onerror = (err) => {
      updateStatus('Signaling error ❌', 'disconnected')
      addLog(`WebSocket error: ${err.message}`)
    }

    ws.value.onclose = () => {
      connected.value = false
      updateStatus('Disconnected from signaling server', 'disconnected')
    }
  } catch (err) {
    addLog(`WS connection failed: ${err.message}`)
  }
}

// === START CALL ===
async function startCall() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    alert('Connect to signaling first!')
    return
  }

  try {
    addLog('Starting call...')
    calling.value = true
    iceCandidatesQueue = []

    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    })
    localVideo.value.srcObject = localStream
    addLog('Local stream acquired')

    peerConnection = new RTCPeerConnection(configuration)
    remoteStream = new MediaStream()
    remoteVideo.value.srcObject = remoteStream

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream)
      addLog(`Added local ${track.kind} track`)
    })

    peerConnection.ontrack = (event) => {
      addLog(`Remote track: ${event.track.kind}`)
      if (event.streams && event.streams[0]) {
        remoteVideo.value.srcObject = event.streams[0]
      } else {
        remoteStream.addTrack(event.track)
      }
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        addLog(`ICE candidate: ${event.candidate.protocol}`)
        ws.value.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }))
      } else {
        addLog('All ICE candidates sent')
      }
    }

    peerConnection.onconnectionstatechange = () => {
      addLog(`Connection state: ${peerConnection.connectionState}`)
      if (peerConnection.connectionState === 'connected') {
        updateStatus('Call connected! ✅', 'connected')
      } else if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        updateStatus(`Call ended (${peerConnection.connectionState})`, 'disconnected')
        calling.value = false
      }
    }

    const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
    await peerConnection.setLocalDescription(offer)
    ws.value.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
    addLog('Offer sent to callee')
    updateStatus('Waiting for answer ⏳', 'waiting')
  } catch (err) {
    addLog(`Error starting call: ${err.message}`)
    updateStatus('Call failed ❌', 'disconnected')
    calling.value = false
  }
}

// === HANDLE ANSWER ===
async function handleAnswer(answer) {
  if (!peerConnection) {
    addLog('No peerConnection for answer')
    return
  }
  try {
    addLog('Setting remote description (answer)...')
    await peerConnection.setRemoteDescription(answer)
    addLog('Remote description set successfully')

    if (iceCandidatesQueue.length > 0) {
      addLog(`Processing ${iceCandidatesQueue.length} queued ICE candidates`)
      for (const c of iceCandidatesQueue) await peerConnection.addIceCandidate(c)
      iceCandidatesQueue = []
    }

    updateStatus('Call established ✅', 'connected')
  } catch (err) {
    addLog(`Error applying answer: ${err.message}`)
  }
}

// === HANDLE ICE CANDIDATES ===
async function handleIceCandidate(candidate) {
  if (!peerConnection) {
    addLog('No peerConnection for ICE')
    return
  }
  try {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(candidate)
      addLog('Added ICE candidate')
    } else {
      iceCandidatesQueue.push(candidate)
      addLog('Queued ICE candidate (remote not ready)')
    }
  } catch (err) {
    addLog(`ICE candidate error: ${err.message}`)
  }
}

// === HANG UP ===
function hangUp() {
  addLog('Hanging up...')
  if (peerConnection) peerConnection.close()
  peerConnection = null

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(t => t.stop())
    remoteStream = null
  }

  calling.value = false
  updateStatus('Call ended', 'disconnected')
}

// === LIFECYCLE ===
onMounted(() => {
  addLog(`Component mounted → UUID: ${uuid}`)
  connectWS()
})

onBeforeUnmount(() => {
  hangUp()
  if (ws.value) ws.value.close()
  addLog('Component unmounted')
})
</script>

<style scoped>
.call-container {
  max-width: 900px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
  text-align: center;
}

.status {
  padding: 10px;
  border-radius: 5px;
  margin: 10px 0;
  font-weight: bold;
}
.connected { background: #d4edda; color: #155724; }
.disconnected { background: #f8d7da; color: #721c24; }
.waiting { background: #fff3cd; color: #856404; }

.buttons {
  margin: 15px 0;
}
button {
  padding: 10px 20px;
  margin: 5px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  transition: background 0.3s;
}
button:hover:not(:disabled) {
  background: #0056b3;
}
button:disabled {
  background: #aaa;
  cursor: not-allowed;
}

.video-container {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 20px;
}
.video-box {
  flex: 1;
  border: 2px solid #ccc;
  border-radius: 8px;
  padding: 10px;
}
video {
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: 6px;
}

.messages {
  margin-top: 20px;
  text-align: left;
}
.log-window {
  border: 1px solid #ccc;
  border-radius: 4px;
  height: 200px;
  overflow-y: auto;
  padding: 10px;
  font-size: 0.9em;
  background: #fafafa;
}
</style>
