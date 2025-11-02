<template>
  <div class="call-container">
    <h1>WebRTC Video Receiver</h1>

    <div class="status" :class="statusClass">{{ statusMessage }}</div>

    <div class="buttons">
      <button @click="acceptCall" :disabled="!hasOffer || calling">Accept Call</button>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'

// === STATE ===
const ws = ref(null)
const uuid = crypto.randomUUID()
const connected = ref(false)
const calling = ref(false)
const hasOffer = ref(false)
const statusMessage = ref('Disconnected')
const statusClass = ref('disconnected')
const logMessages = ref([])

const localVideo = ref(null)
const remoteVideo = ref(null)

let peerConnection = null
let localStream = null
let remoteStream = null
let receivedOffer = null
let iceCandidatesQueue = []

// === CONFIG ===
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
  console.log('%c[WebRTC Receiver]', 'color:#28a745', msg)
  logMessages.value.push(line)
  if (logMessages.value.length > 500) logMessages.value.shift()
}

function updateStatus(message, type) {
  statusMessage.value = message
  statusClass.value = type
  addLog(`STATUS → ${message}`)
}

// === CONNECT TO WS ===
function connectWS() {
  const url = `ws://localhost:8080/connect/${uuid}`
  addLog(`Connecting to signaling server: ${url}`)
  ws.value = new WebSocket(url)

  ws.value.onopen = () => {
    connected.value = true
    updateStatus('Connected to signaling server ✅', 'connected')
  }

  ws.value.onmessage = async (event) => {
    const msg = JSON.parse(event.data)
    addLog(`Received: ${msg.type}`)

    if (msg.type === 'offer') {
      receivedOffer = msg
      hasOffer.value = true
      updateStatus('Incoming call... 📞', 'waiting')
    } else if (msg.type === 'ice-candidate') {
      await handleIceCandidate(msg.candidate)
    }
  }

  ws.value.onclose = () => {
    connected.value = false
    updateStatus('Disconnected from signaling server', 'disconnected')
  }

  ws.value.onerror = (err) => {
    updateStatus('Signaling error ❌', 'disconnected')
    addLog(`WebSocket error: ${err.message}`)
  }
}

// === ACCEPT CALL ===
async function acceptCall() {
  if (!receivedOffer) {
    alert('No offer received yet!')
    return
  }

  try {
    addLog('Accepting call...')
    calling.value = true
    iceCandidatesQueue = []

    // === Проверка устройств ===
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter(d => d.kind === 'videoinput')
    const mics = devices.filter(d => d.kind === 'audioinput')
    addLog(`Detected devices: ${cams.length} cameras, ${mics.length} microphones`)

    // === Попытка получить медиа ===
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: cams.length ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: mics.length ? { echoCancellation: true, noiseSuppression: true } : false
      })
      addLog('Local media stream acquired')
    } catch (err) {
      addLog(`Primary getUserMedia failed (${err.name}): ${err.message}`)
      // fallback: минимальная конфигурация
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        addLog('Fallback media stream acquired (basic config)')
      } catch (err2) {
        addLog(`Fallback getUserMedia failed (${err2.name}): ${err2.message}`)
        updateStatus('Media access failed ❌', 'disconnected')
        calling.value = false
        throw err2
      }
    }

    // === Назначаем локальное видео ===
    localVideo.value.srcObject = localStream

    // === Создаём PeerConnection ===
    peerConnection = new RTCPeerConnection(configuration)
    remoteStream = new MediaStream()
    remoteVideo.value.srcObject = remoteStream

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream)
      addLog(`Added local ${track.kind} track`)
    })

    peerConnection.ontrack = (event) => {
      addLog(`Remote track received: ${event.track.kind}`)
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
        updateStatus('Call connected ✅', 'connected')
      } else if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        updateStatus(`Call ended (${peerConnection.connectionState})`, 'disconnected')
        calling.value = false
      }
    }

    addLog('Setting remote description (offer)...')
    await peerConnection.setRemoteDescription(receivedOffer)
    addLog('Remote description set')

    if (iceCandidatesQueue.length > 0) {
      addLog(`Processing ${iceCandidatesQueue.length} queued ICE candidates`)
      for (const c of iceCandidatesQueue) await peerConnection.addIceCandidate(c)
      iceCandidatesQueue = []
    }

    const answer = await peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    })
    await peerConnection.setLocalDescription(answer)

    ws.value.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }))
    addLog('Answer sent to caller')
    updateStatus('Call accepted ✅', 'connected')
    hasOffer.value = false
  } catch (err) {
    addLog(`Failed to accept call: ${err.message}`)
    updateStatus('Call failed ❌', 'disconnected')
    calling.value = false
  }
}

// === HANDLE ICE ===
async function handleIceCandidate(candidate) {
  if (!peerConnection) {
    addLog('No PeerConnection for ICE candidate')
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
  receivedOffer = null
  iceCandidatesQueue = []
  updateStatus('Call ended', 'disconnected')
}

// === LIFECYCLE ===
onMounted(() => {
  addLog(`Receiver mounted → UUID: ${uuid}`)
  connectWS()
})

onBeforeUnmount(() => {
  hangUp()
  if (ws.value) ws.value.close()
  addLog('Receiver unmounted')
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
  background: #28a745;
  color: white;
  cursor: pointer;
  transition: background 0.3s;
}
button:hover:not(:disabled) {
  background: #218838;
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
