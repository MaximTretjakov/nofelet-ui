<template>
  <div class="page">
    <div class="card">
      <h2>Caller — Initiate Call</h2>
      <p class="muted">You are the caller. Create call link and wait for callee.</p>

      <div class="status" :class="statusClass">{{ statusText }}</div>

      <div class="controls">
        <button @click="createAndConnect" :disabled="connecting || connected" class="btn primary">Create & Connect</button>
        <button @click="startCall" :disabled="!connected || calling" class="btn accent">Start Call</button>
        <button @click="hangUp" :disabled="!calling" class="btn danger">Hang Up</button>
        <button @click="disconnect" :disabled="!connected" class="btn">Disconnect</button>
      </div>

      <div class="link" v-if="uuid">
        <label>Invite link</label>
        <div class="invite-row">
          <input readonly :value="inviteLink" class="invite-input" />
          <button @click="copyInvite" class="btn small">Copy</button>
        </div>
        <p class="muted">Send this link to the callee. When they open it, they will auto-connect and accept.</p>
      </div>

      <div class="videos">
        <div class="vbox">
          <h3>Local</h3>
          <video ref="localVideo" autoplay muted playsinline></video>
        </div>
        <div class="vbox">
          <h3>Remote</h3>
          <video ref="remoteVideo" autoplay playsinline></video>
        </div>
      </div>

      <div class="logs">
        <h4>Logs</h4>
        <div class="log" v-for="(m,i) in recentLogs" :key="i">{{ m }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const localVideo = ref(null)
const remoteVideo = ref(null)

const uuid = ref('')
const ws = ref(null)
const pc = ref(null)
const localStream = ref(null)

const connected = ref(false)
const connecting = ref(false)
const calling = ref(false)
const logs = ref([])

const statusText = computed(() => {
  if (calling.value) return 'In call'
  if (connected.value) return 'Connected to signaling'
  if (connecting.value) return 'Connecting...'
  return 'Disconnected'
})
const statusClass = computed(() => {
  if (calling.value) return 's-call'
  if (connected.value) return 's-on'
  if (connecting.value) return 's-wait'
  return 's-off'
})

function addLog(text){
  const ts = new Date().toLocaleTimeString()
  logs.value.push(`[${ts}] ${text}`)
  if (logs.value.length > 200) logs.value.shift()
}

const recentLogs = computed(()=> logs.value.slice(-50))

async function createAndConnect(){
  if (!crypto || !crypto.randomUUID) {
    uuid.value = Math.random().toString(36).slice(2,10)
  } else {
    uuid.value = crypto.randomUUID()
  }
  await connect()
}

async function connect(){
  if (!uuid.value) {
    addLog('No UUID — call createAndConnect first.')
    return
  }
  if (connected.value || connecting.value) return
  connecting.value = true
  const url = `wss://nofelet.duckdns.org:8443/connect/${uuid.value}`
  addLog('Connecting to ' + url)
  try {
    ws.value = new WebSocket(url)
    ws.value.onopen = () => {
      connecting.value = false
      connected.value = true
      addLog('WebSocket open')
    }
    ws.value.onmessage = async (ev) => {
      addLog('← ' + ev.data)
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'answer') {
          addLog('Answer received — setting remote description')
          if (pc.value) {
            await pc.value.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
            calling.value = true
          }
        } else if (msg.type === 'ice-candidate') {
          if (pc.value) {
            try { await pc.value.addIceCandidate(msg.candidate) } catch(e){ addLog('ICE add error: '+e) }
          }
        }
      } catch(e){
        addLog('msg parse error: '+e.message)
      }
    }
    ws.value.onerror = (e)=> { addLog('WebSocket error'); connecting.value=false; connected.value=false }
    ws.value.onclose = ()=> { addLog('WebSocket closed'); connected.value=false; calling.value=false }
  } catch(e){
    addLog('connect failed: ' + e.message)
    connecting.value = false
  }
}

async function startCall(){
  if (!connected.value) { addLog('Not connected'); return }
  try {
    addLog('Acquiring media...')
    localStream.value = await navigator.mediaDevices.getUserMedia({ video:true, audio:true })
    localVideo.value.srcObject = localStream.value

    pc.value = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // send ICE candidates to signaling
    pc.value.onicecandidate = (e) => {
      if (e.candidate && ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }))
      }
    }

    pc.value.ontrack = (e) => {
      if (remoteVideo.value) remoteVideo.value.srcObject = e.streams[0]
    }

    localStream.value.getTracks().forEach(t => pc.value.addTrack(t, localStream.value))

    const offer = await pc.value.createOffer()
    await pc.value.setLocalDescription(offer)

    // send offer via signaling
    ws.value.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
    addLog('Offer sent')
    // wait for answer in onmessage
  } catch(e){
    addLog('startCall error: ' + e.message)
  }
}

function copyInvite(){
  const link = inviteLink.value
  navigator.clipboard.writeText(link).then(()=> addLog('Invite copied to clipboard'))
}

const inviteLink = computed(()=> {
  // Use window.location to build absolute link to /invite/<uuid>
  const base = window.location.origin
  return `${base}/invite/${uuid.value}`
})

async function hangUp(){
  if (pc.value) { pc.value.close(); pc.value = null }
  if (localStream.value) { localStream.value.getTracks().forEach(t=>t.stop()); localStream.value = null }
  calling.value = false
  addLog('Call hung up')
}

function disconnect(){
  if (ws.value) { ws.value.close(); ws.value = null }
  hangUp()
  addLog('Disconnected from signaling')
  connected.value = false
  connecting.value = false
}

onBeforeUnmount(()=>{
  disconnect()
})

onMounted(()=>{
  // try to get camera preview immediately (optional)
  navigator.mediaDevices.getUserMedia({ video:true, audio:false }).then(s=>{ localVideo.value.srcObject = s }).catch(()=>{})
  addLog('Caller ready')
})
</script>

<style scoped>
.page{ display:flex; align-items:center; justify-content:center; min-height:100vh; background: linear-gradient(180deg,#0f172a,#071032); padding:20px; }
.card{ width:940px; max-width:100%; background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)); border-radius:14px; padding:22px; box-shadow: 0 10px 30px rgba(2,6,23,0.7); color:#e6eef8; }
h2{ margin:0 0 6px 0; font-weight:700; }
.muted{ color:#9fb0d6; margin-bottom:12px; }
.status{ padding:8px 12px; border-radius:8px; display:inline-block; margin-bottom:12px; font-weight:600; }
.s-on{ background:#08341a; color:#7ee7a1; }
.s-off{ background:#3b0b0b; color:#ff9b9b; }
.s-wait{ background:#3a2f07; color:#ffd97a; }
.s-call{ background:#06283a; color:#7fe0ff; }

.controls{ display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.btn{ background:transparent; border:1px solid rgba(255,255,255,0.12); color:inherit; padding:8px 12px; border-radius:10px; cursor:pointer; }
.btn:hover{ transform:translateY(-2px); }
.btn.primary{ background:linear-gradient(90deg,#6ee7b7,#3b82f6); color:#04201a; border:none; }
.btn.accent{ background:linear-gradient(90deg,#7c3aed,#06b6d4); color:white; border:none; }
.btn.danger{ background:linear-gradient(90deg,#ef4444,#f97316); color:white; border:none; }
.btn.small{ padding:6px 8px; font-size:13px; }

.link{ margin-bottom:12px; }
.invite-row{ display:flex; gap:8px; margin-top:6px; }
.invite-input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:inherit; }

.videos{ display:flex; gap:18px; margin-top:12px; }
.vbox{ flex:1; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; }
video{ width:100%; height:260px; background:#000; border-radius:8px; object-fit:cover; }

.logs{ margin-top:14px; max-height:160px; overflow:auto; border-top:1px dashed rgba(255,255,255,0.04); padding-top:10px; }
.log{ font-family:monospace; font-size:13px; color:#cfe8ff; padding:4px 0; }
</style>
