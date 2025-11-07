<template>
  <div class="call-container">
    <h1>WebRTC Video Call</h1>
    
    <div class="status" :class="statusClass">{{ statusMessage }}</div>
    
    <div class="controls-group">
      <button @click="connect" :disabled="connected">Connect</button>
      <button @click="startCall" :disabled="!connected || calling">Start Call</button>
      <button @click="acceptCall" :disabled="!connected || !hasIncomingCall || calling" class="accept-btn">
        Accept Call
      </button>
      <button @click="hangUp" :disabled="!calling" class="hangup-btn">Hang Up</button>
      <button @click="disconnect" :disabled="!connected">Disconnect</button>
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
    
    <!-- Компактная панель для отладки -->
    <div class="debug-panel">
      <div class="debug-section">
        <h4 @click="toggleMessages">Signaling Messages ▼</h4>
        <div class="messages" v-if="showMessages">
          <div class="call-link">
            <strong>Call Link:</strong> 
            <a :href="callLink" target="_blank">{{ callLink }}</a>
            <button @click="copyCallLink" class="small-btn copy-btn">Copy</button>
          </div>
          <div v-for="(msg, index) in recentMessages" :key="index" :class="msg.type">
            {{ msg.text }}
          </div>
        </div>
      </div>
      
      <div class="debug-section">
        <h4 @click="toggleManual">Manual SDP ▼</h4>
        <div v-if="showManual" class="manual-fallback">
          <div>
            <textarea v-model="offerInput" placeholder="Offer SDP..." class="compact-textarea"></textarea>
            <button @click="acceptCall" class="small-btn">Use Offer</button>
          </div>
          <div>
            <textarea v-model="answerInput" placeholder="Answer SDP..." class="compact-textarea"></textarea>
            <button @click="setAnswer" class="small-btn">Use Answer</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'

// === STATE ===
const ws = ref(null)
const route = useRoute()

// Извлекаем UUID из query параметра или генерируем новый
const uuid = computed(() => {
  // Пытаемся извлечь UUID из query параметра (?uuid=...)
  const urlParams = new URLSearchParams(window.location.search)
  const uuidFromUrl = urlParams.get('uuid')
  
  if (uuidFromUrl) {
    return uuidFromUrl
  }
  // Иначе генерируем новый UUID
  return crypto.randomUUID()
})

const connected = ref(false)
const calling = ref(false)
const hasIncomingCall = ref(false)
const statusMessage = ref('Disconnected')
const statusClass = ref('disconnected')
const messages = ref([])
const showMessages = ref(false)
const showManual = ref(false)

const localVideo = ref(null)
const remoteVideo = ref(null)
const offerInput = ref('')
const answerInput = ref('')

let peerConnection = null
let localStream = null
let remoteStream = null
let receivedOffer = null
let iceCandidatesQueue = []
let answerTimeout = null

// Генерация ссылки для вызова
const callLink = computed(() => {
  return `https://maximtretjakov.github.io/nofelet-ui/call/?uuid=${uuid.value}`
})

// Только последние 20 сообщений для компактного отображения
const recentMessages = computed(() => {
  return messages.value.slice(-20)
})

// === ICE CONFIGURATION ===
const configuration = {
  iceServers: [
    // STUN серверы
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // TURN серверы
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
function addMessage(type, text) {
  const timestamp = new Date().toLocaleTimeString()
  const message = { type, text: `[${timestamp}] ${text}` }
  messages.value.push(message)
  if (messages.value.length > 100) messages.value.shift()
}

function updateStatus(message, type) {
  statusMessage.value = message
  statusClass.value = type
  addMessage('status', message)
}

function toggleMessages() {
  showMessages.value = !showMessages.value
}

function toggleManual() {
  showManual.value = !showManual.value
}

function logConnectionStates() {
  if (peerConnection) {
    addMessage('state', `ICE: ${peerConnection.iceConnectionState}, Signaling: ${peerConnection.signalingState}, Connection: ${peerConnection.connectionState}`)
  }
}

function clearAnswerTimeout() {
  if (answerTimeout) {
    clearTimeout(answerTimeout)
    answerTimeout = null
  }
}

// Копирование ссылки вызова
function copyCallLink() {
  navigator.clipboard.writeText(callLink.value).then(() => {
    addMessage('system', 'Call link copied to clipboard!')
  }).catch(err => {
    addMessage('error', 'Failed to copy call link: ' + err)
  })
}

// === WEB SOCKET CONNECTION ===
function connect() {
  try {
    const url = `wss://nofelet.duckdns.org:8443/connect/${uuid.value}`
    addMessage('system', `Connecting to signaling server: ${url}`)
    addMessage('system', `Call link: ${callLink.value}`)
    
    // Проверяем источник UUID
    const urlParams = new URLSearchParams(window.location.search)
    const uuidFromUrl = urlParams.get('uuid')
    addMessage('system', `Using UUID: ${uuid.value} ${uuidFromUrl ? '(from invitation link)' : '(newly generated)'}`)
    
    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      connected.value = true
      updateStatus('Connected to signaling server ✅', 'connected')
      addMessage('system', 'WebSocket connection established')
    }

    ws.value.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data)
        addMessage('signaling', `Received: ${message.type}`)
        
        if (message.type === 'offer') {
          // Мы получаем входящий вызов (как callee)
          receivedOffer = message
          hasIncomingCall.value = true
          offerInput.value = JSON.stringify(message)
          updateStatus('Incoming call... Click Accept', 'waiting')
          addMessage('system', 'Offer received from caller - ready to accept call')
        } else if (message.type === 'answer') {
          // Мы звонивший и получаем ответ (как caller)
          addMessage('system', 'Answer received from callee, processing...')
          clearAnswerTimeout()
          await handleAnswer(message)
        } else if (message.type === 'ice-candidate') {
          addMessage('ice', 'Received ICE candidate from peer')
          await handleIceCandidate(message.candidate)
        }
      } catch (error) {
        addMessage('error', `Message parsing error: ${error.message}`)
      }
    }

    ws.value.onerror = (error) => {
      updateStatus('Signaling error ❌', 'disconnected')
      addMessage('error', `WebSocket error: ${error}`)
    }

    ws.value.onclose = () => {
      connected.value = false
      hasIncomingCall.value = false
      calling.value = false
      updateStatus('Disconnected from signaling server', 'disconnected')
      addMessage('system', 'WebSocket connection closed')
    }
  } catch (error) {
    addMessage('error', `Connection failed: ${error.message}`)
  }
}

function disconnect() {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  hangUp()
}

// === CALL MANAGEMENT ===
async function startCall() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    alert('First connect to signaling server!')
    return
  }

  try {
    addMessage('system', 'Starting call as caller...')
    calling.value = true
    hasIncomingCall.value = false
    iceCandidatesQueue = []
    clearAnswerTimeout()

    // Получаем медиапоток
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    
    localVideo.value.srcObject = localStream
    addMessage('system', 'Local media stream acquired')

    // Создаем PeerConnection
    peerConnection = new RTCPeerConnection(configuration)
    addMessage('system', 'PeerConnection created with TURN servers')
    logConnectionStates()

    // Создаем удаленный поток
    remoteStream = new MediaStream()
    remoteVideo.value.srcObject = remoteStream

    // Добавляем локальные треки
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream)
      addMessage('system', `Added local ${track.kind} track`)
    })

    // Обработчик удаленных треков
    peerConnection.ontrack = (event) => {
      addMessage('system', `Remote track received: ${event.track.kind}`)
      
      if (event.streams && event.streams[0]) {
        remoteVideo.value.srcObject = event.streams[0]
        addMessage('system', `Set remote ${event.track.kind} stream`)
      } else {
        remoteStream.addTrack(event.track)
        addMessage('system', `Added ${event.track.kind} track to remote stream`)
      }
    }

    // ICE кандидаты
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate
        addMessage('ice', `ICE candidate: ${candidate.type} ${candidate.protocol} ${candidate.address}:${candidate.port}`)
        
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }))
        }
      } else {
        addMessage('ice', 'All ICE candidates generated')
      }
    }

    // Состояние соединения
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      addMessage('connection', `Connection state: ${state}`)
      logConnectionStates()
      
      if (state === 'connected') {
        updateStatus('Call connected! ✅', 'connected')
        clearAnswerTimeout()
      } else if (state === 'disconnected' || state === 'failed') {
        updateStatus(`Call ${state} ❌`, 'disconnected')
        calling.value = false
      } else if (state === 'connecting') {
        updateStatus('Connecting... 🔄', 'waiting')
      }
    }

    // ICE состояние
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState
      addMessage('ice', `ICE connection state: ${state}`)
      logConnectionStates()
    }

    // Signaling состояние
    peerConnection.onsignalingstatechange = () => {
      const state = peerConnection.signalingState
      addMessage('signaling', `Signaling state: ${state}`)
      logConnectionStates()
    }

    // Создаем и отправляем offer
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      iceRestart: false
    })
    addMessage('system', 'Offer created')
    
    await peerConnection.setLocalDescription(offer)
    addMessage('system', 'Local description set')
    logConnectionStates()

    // Отправляем offer через signaling
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'offer',
        sdp: offer.sdp
      }))
      addMessage('system', 'Offer sent to signaling server')
    } else {
      addMessage('error', 'WebSocket not connected, cannot send offer')
      return
    }

    addMessage('system', 'Waiting for answer from callee...')
    updateStatus('Waiting for answer... ⏳', 'waiting')

    // Таймаут ожидания answer
    answerTimeout = setTimeout(() => {
      if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
        addMessage('warning', 'No answer received after 30 seconds')
        addMessage('system', 'You can manually paste the answer SDP above')
      }
    }, 30000)

  } catch (error) {
    addMessage('error', `Failed to start call: ${error.message}`)
    updateStatus('Call failed', 'disconnected')
    calling.value = false
    clearAnswerTimeout()
  }
}

async function acceptCall() {
  // Проверяем есть ли offer от signaling или manual input
  if (!receivedOffer) {
    const offerText = offerInput.value.trim()
    if (offerText) {
      try {
        receivedOffer = JSON.parse(offerText)
        addMessage('system', 'Using manual offer from textarea')
      } catch (e) {
        alert('Invalid offer format in textarea')
        return
      }
    } else {
      alert('No offer received yet! Check signaling connection or paste offer manually.')
      return
    }
  }

  try {
    addMessage('system', 'Accepting call as callee...')
    calling.value = true
    iceCandidatesQueue = []

    // Получаем медиапоток
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    
    localVideo.value.srcObject = localStream
    addMessage('system', 'Local media stream acquired')

    // Создаем PeerConnection
    peerConnection = new RTCPeerConnection(configuration)
    addMessage('system', 'PeerConnection created with TURN servers')
    logConnectionStates()

    // Создаем удаленный поток
    remoteStream = new MediaStream()
    remoteVideo.value.srcObject = remoteStream

    // Добавляем локальные треки
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream)
      addMessage('system', `Added local ${track.kind} track`)
    })

    // Обработчик удаленных треков
    peerConnection.ontrack = (event) => {
      addMessage('system', `Remote track received: ${event.track.kind}`)
      
      if (event.streams && event.streams[0]) {
        remoteVideo.value.srcObject = event.streams[0]
        addMessage('system', `Set remote ${event.track.kind} stream`)
      } else {
        remoteStream.addTrack(event.track)
        addMessage('system', `Added ${event.track.kind} track to remote stream`)
      }
    }

    // ICE кандидаты
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate
        addMessage('ice', `ICE candidate: ${candidate.type} ${candidate.protocol} ${candidate.address}:${candidate.port}`)
        
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }))
        }
      } else {
        addMessage('ice', 'All ICE candidates generated')
      }
    }

    // Состояние соединения
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      addMessage('connection', `Connection state: ${state}`)
      logConnectionStates()
      
      if (state === 'connected') {
        updateStatus('Call connected! ✅', 'connected')
      } else if (state === 'disconnected' || state === 'failed') {
        updateStatus(`Call ${state} ❌`, 'disconnected')
        calling.value = false
      } else if (state === 'connecting') {
        updateStatus('Connecting... 🔄', 'waiting')
      }
    }

    // Устанавливаем удаленное описание (offer)
    addMessage('system', 'Setting remote description (offer)...')
    await peerConnection.setRemoteDescription(receivedOffer)
    addMessage('system', 'Remote description set')
    logConnectionStates()

    // Обрабатываем отложенные ICE кандидаты
    if (iceCandidatesQueue.length > 0) {
      addMessage('system', `Processing ${iceCandidatesQueue.length} queued ICE candidates`)
      for (const candidate of iceCandidatesQueue) {
        try {
          await peerConnection.addIceCandidate(candidate)
          addMessage('ice', 'Added queued ICE candidate')
        } catch (err) {
          addMessage('error', `Error adding queued candidate: ${err.message}`)
        }
      }
      iceCandidatesQueue = []
    }

    // Создаем и отправляем answer
    const answer = await peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    })
    addMessage('system', 'Answer created')
    
    await peerConnection.setLocalDescription(answer)
    addMessage('system', 'Local description set')
    logConnectionStates()

    // Отправляем answer через signaling
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'answer',
        sdp: answer.sdp
      }))
      addMessage('system', 'Answer sent to signaling server')
      answerInput.value = JSON.stringify(answer)
    } else {
      addMessage('warning', 'WebSocket not connected - answer not sent via signaling')
      addMessage('system', 'Copy this answer and send it to caller manually:')
      answerInput.value = JSON.stringify(answer)
    }

    updateStatus('Call accepted! ✅', 'connected')
    hasIncomingCall.value = false

  } catch (error) {
    addMessage('error', `Failed to accept call: ${error.message}`)
    updateStatus('Call failed', 'disconnected')
    calling.value = false
    hasIncomingCall.value = false
  }
}

// === ANSWER HANDLING ===
async function handleAnswer(answer) {
  if (!peerConnection) {
    addMessage('error', 'No PeerConnection when receiving answer')
    return
  }
  
  try {
    addMessage('system', 'Setting remote description (answer)...')
    await peerConnection.setRemoteDescription(answer)
    addMessage('system', 'Remote description set successfully')
    logConnectionStates()
    
    // Обрабатываем отложенные ICE кандидаты
    if (iceCandidatesQueue.length > 0) {
      addMessage('system', `Processing ${iceCandidatesQueue.length} queued ICE candidates`)
      for (const candidate of iceCandidatesQueue) {
        try {
          await peerConnection.addIceCandidate(candidate)
          addMessage('ice', 'Added queued ICE candidate')
        } catch (err) {
          addMessage('error', `Error adding queued candidate: ${err.message}`)
        }
      }
      iceCandidatesQueue = []
    }
    
    answerInput.value = JSON.stringify(answer)
    
  } catch (error) {
    addMessage('error', `Error setting answer: ${error.message}`)
  }
}

async function setAnswer() {
  const answerText = answerInput.value
  if (!answerText) {
    alert('Paste answer SDP first!')
    return
  }
  
  try {
    const answer = JSON.parse(answerText)
    addMessage('system', 'Setting manual answer...')
    await handleAnswer(answer)
  } catch (error) {
    addMessage('error', `Invalid answer format: ${error.message}`)
  }
}

// === ICE CANDIDATE HANDLING ===
async function handleIceCandidate(candidate) {
  if (!peerConnection) {
    addMessage('error', 'No PeerConnection for ICE candidate - queuing')
    iceCandidatesQueue.push(candidate)
    return
  }
  
  try {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(candidate)
      addMessage('ice', 'Added ICE candidate from peer')
    } else {
      // Сохраняем кандидаты до установки remoteDescription
      iceCandidatesQueue.push(candidate)
      addMessage('ice', `Queued ICE candidate (${iceCandidatesQueue.length} pending)`)
    }
  } catch (error) {
    addMessage('error', `Error adding ICE candidate: ${error.message}`)
  }
}

// === HANG UP ===
function hangUp() {
  addMessage('system', 'Hanging up...')
  
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop())
    remoteStream = null
  }
  
  localVideo.value.srcObject = null
  remoteVideo.value.srcObject = null
  
  calling.value = false
  hasIncomingCall.value = false
  receivedOffer = null
  iceCandidatesQueue = []
  clearAnswerTimeout()
  
  updateStatus('Call ended', 'disconnected')
  addMessage('system', 'Call ended')
}

// === LIFECYCLE ===
onMounted(() => {
  addMessage('system', `Component mounted → UUID: ${uuid.value}`)
  addMessage('system', `Call link: ${callLink.value}`)
  
  // Проверяем источник UUID
  const urlParams = new URLSearchParams(window.location.search)
  const uuidFromUrl = urlParams.get('uuid')
  addMessage('system', `UUID source: ${uuidFromUrl ? 'from invitation link' : 'newly generated'}`)
})

onBeforeUnmount(() => {
  disconnect()
  addMessage('system', 'Component unmounted')
})
</script>

<style scoped>
.call-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 15px;
  font-family: Arial, sans-serif;
  min-height: 100vh;
}

h1 {
  text-align: center;
  margin-bottom: 15px;
  color: #2c3e50;
}

.status {
  padding: 10px;
  border-radius: 6px;
  margin: 10px 0;
  font-weight: bold;
  text-align: center;
  font-size: 14px;
}
.connected { background: #d4edda; color: #155724; }
.disconnected { background: #f8d7da; color: #721c24; }
.waiting { background: #fff3cd; color: #856404; }

.controls-group {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 20px 0;
  flex-wrap: wrap;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s ease;
  min-width: 100px;
}

button:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.accept-btn {
  background: #28a745;
}

.accept-btn:hover:not(:disabled) {
  background: #218838;
}

.hangup-btn {
  background: #dc3545;
}

.hangup-btn:hover:not(:disabled) {
  background: #c82333;
}

.video-container {
  display: flex;
  gap: 20px;
  margin: 20px 0;
  justify-content: center;
  flex-wrap: wrap;
}

.video-box {
  flex: 1;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
  max-width: 400px;
  min-width: 280px;
}

.video-box h3 {
  text-align: center;
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 14px;
}

video {
  width: 100%;
  height: 200px;
  background: #000;
  border-radius: 6px;
  object-fit: cover;
}

/* Компактная панель отладки */
.debug-panel {
  margin: 20px 0;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.debug-section {
  border-bottom: 1px solid #dee2e6;
}

.debug-section:last-child {
  border-bottom: none;
}

.debug-section h4 {
  margin: 0;
  padding: 12px 15px;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 13px;
  color: #495057;
  user-select: none;
  transition: background 0.2s;
}

.debug-section h4:hover {
  background: #e9ecef;
}

.messages {
  padding: 10px 15px;
  max-height: 150px;
  overflow-y: auto;
  background: white;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.3;
}

.messages div {
  margin: 2px 0;
  padding: 1px 0;
  word-break: break-word;
}

.call-link {
  background: #e7f3ff;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  border-left: 3px solid #007bff;
}

.call-link a {
  color: #007bff;
  text-decoration: none;
  word-break: break-all;
}

.call-link a:hover {
  text-decoration: underline;
}

.copy-btn {
  margin-left: 8px;
  padding: 2px 6px !important;
  font-size: 9px !important;
  background: #28a745 !important;
}

.system { color: #6c757d; }
.signaling { color: #007bff; }
.ice { color: #fd7e14; }
.connection { color: #20c997; }
.error { color: #dc3545; }
.warning { color: #ffc107; }

.manual-fallback {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  padding: 15px;
  background: white;
}

.compact-textarea {
  width: 100%;
  height: 80px;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  resize: vertical;
  margin-bottom: 5px;
}

.small-btn {
  min-width: auto !important;
  padding: 4px 8px !important;
  font-size: 10px !important;
  width: 100%;
}

/* Адаптивность */
@media (max-width: 768px) {
  .call-container {
    padding: 10px;
  }
  
  .controls-group {
    gap: 5px;
  }
  
  button {
    min-width: 80px;
    padding: 6px 12px;
    font-size: 11px;
  }
  
  .video-box {
    min-width: 100%;
  }
  
  video {
    height: 180px;
  }
  
  .manual-fallback {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .compact-textarea {
    height: 60px;
    font-size: 9px;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1.5em;
  }
  
  .status {
    font-size: 12px;
    padding: 8px;
  }
  
  .messages {
    max-height: 120px;
    font-size: 10px;
  }
  
  .call-link {
    font-size: 10px;
  }
}
</style>