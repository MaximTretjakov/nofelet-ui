<template>
  <div class="page">
    <div class="card">
      <h2>Callee — Receive Call</h2>
      <p class="muted">You are the callee. Open via invite link or paste UUID.</p>

      <div class="status" :class="statusClass">{{ statusText }}</div>

      <div class="uuid-row">
        <input v-model="manualUUID" placeholder="Or paste UUID here..." class="invite-input" />
        <button @click="applyManual" class="btn small">Use UUID</button>
      </div>

      <div class="controls">
        <button @click="connect" :disabled="connecting || connected" class="btn primary">Connect</button>
        <button @click="acceptCall" :disabled="!connected || !hasOffer || calling" class="btn accent">Accept Call</button>
        <button @click="hangUp" :disabled="!calling" class="btn danger">Hang Up</button>
        <button @click="disconnect" :disabled="!connected" class="btn">Disconnect</button>
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
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const localVideo = ref(null)
const remoteVideo = ref(null)

const manualUUID = ref('')
const uuid = ref('')
const ws = ref(null)
let pc = null
let localStream = null

const connecting = ref(false)
const connected = ref(false)
const calling = ref(false)
const hasOffer = ref(false)
const logs = ref([])
let receivedOffer = null
let iceQueue = []

function addLog(text){
  const ts = new Date().toLocaleTimeString()
  logs.value.push(`[${ts}] ${text}`)
  if (logs.value.length > 200) logs.value.shift()
}
const recentLogs = computed(()=> logs.value.slice(-50))

const statusText = computed(()=> {
  if (calling.value) return 'In call'
  if (connected.value) return 'Connected to signaling'
  if (connecting.value) return 'Connecting...'
  return 'Disconnected'
})
const statusClass = computed(()=> {
  if (calling.value) return 's-call'
  if (connected.value) return 's-on'
  if (connecting.value) return 's-wait'
  return 's-off'
})

function applyManual(){
  if (!manualUUID.value.trim()) return
  uuid.value = manualUUID.value.trim()
  addLog('Manual UUID applied: ' + uuid.value)
  connect()
}

function copyInvite(){ navigator.clipboard.writeText(inviteLink.value).then(()=> addLog('Invite copied')) }

const inviteLink = computed(()=> `${window.location.origin}/invite/${uuid.value}`)

async function connect(){
  if (!uuid.value){
    // try query param
    const params = new URLSearchParams(window.location.search)
    const q = params.get('uuid')
    if (q) uuid.value = q
  }
  if (!uuid.value) { addLog('No UUID to connect'); return }
  if (connected.value || connecting.value) return
  connecting.value = true
  const url = `wss://nofelet.duckdns.org:8443/connect/${uuid.value}`
  addLog('Connecting to ' + url)
  try {
    ws.value = new WebSocket(url)
    ws.value.onopen = ()=> { connecting.value=false; connected.value=true; addLog('WebSocket open') }
    ws.value.onmessage = async (ev)=> {
      addLog('← ' + ev.data)
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'offer') {
          addLog('Offer received')
          receivedOffer = { type: 'offer', sdp: msg.sdp }
          hasOffer.value = true
          // auto-accept if opened from invite link
          const params = new URLSearchParams(window.location.search)
          if (params.get('uuid')) {
            addLog('Auto-accepting (invite link)')
            setTimeout(()=> acceptCall(), 800)
          }
        } else if (msg.type === 'ice-candidate') {
          if (pc) {
            try { await pc.addIceCandidate(msg.candidate) } catch(e){ addLog('ICE add err: '+e) }
          } else {
            iceQueue.push(msg.candidate)
          }
        } else if (msg.type === 'answer') {
          addLog('Unexpected answer received (callee).')
        }
      } catch(e){ addLog('msg parse error: '+e.message) }
    }
    ws.value.onerror = ()=> { addLog('WebSocket error'); connecting.value=false; connected.value=false }
    ws.value.onclose = ()=> { addLog('WebSocket closed'); connected.value=false; calling.value=false }
  } catch(e){ addLog('connect failed: '+e.message); connecting.value=false }
}

async function acceptCall(){
  if (!receivedOffer) {
    addLog('No offer to accept')
    return
  }
  try {
    addLog('Acquiring media...')
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true })
    localVideo.value.srcObject = localStream

    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.ontrack = (e)=> { if (remoteVideo.value) remoteVideo.value.srcObject = e.streams[0] }
    pc.onicecandidate = (e)=> {
      if (e.candidate && ws.value && ws.value.readyState===WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type:'ice-candidate', candidate: e.candidate }))
      }
    }

    localStream.getTracks().forEach(t=> pc.addTrack(t, localStream))

    // set remote desc (offer)
    await pc.setRemoteDescription(receivedOffer)

    // add queued ICEs
    if (iceQueue.length) {
      for (const c of iceQueue) {
        try{ await pc.addIceCandidate(c) }catch(e){ addLog('queued ICE err: '+e.message) }
      }
      iceQueue = []
    }

    // create answer
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // send answer via signaling
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type:'answer', sdp: answer.sdp }))
      addLog('Answer sent')
    } else {
      addLog('WS not open, cannot send answer')
    }

    calling.value = true
    hasOffer.value = false
  } catch(e){
    addLog('acceptCall error: ' + e.message)
  }
}

async function hangUp(){
  if (pc){ pc.close(); pc=null }
  if (localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream=null }
  calling.value = false; hasOffer.value=false; receivedOffer=null; iceQueue=[]
  addLog('Call hung up')
}

function disconnect(){
  if (ws.value){ ws.value.close(); ws.value=null }
  hangUp()
  addLog('Disconnected')
  connected.value=false; connecting.value=false
}

onMounted(()=>{
  // If route is /invite/:uuid, router will redirect to /callee?uuid=..., but also support direct query
  const params = new URLSearchParams(window.location.search)
  const q = params.get('uuid')
  if (q) {
    uuid.value = q
    addLog('Component mounted with invite UUID: ' + q)
    // auto-connect for invite
    connect()
  } else {
    addLog('Callee ready — waiting for UUID or paste.')
  }
})

onBeforeUnmount(()=> disconnect())
</script>

<style scoped>
.page{ display:flex; align-items:center; justify-content:center; min-height:100vh; background: linear-gradient(180deg,#041024,#071032); padding:20px; }
.card{ width:940px; max-width:100%; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02)); border-radius:14px; padding:22px; box-shadow: 0 8px 24px rgba(2,6,23,0.7); color:#e6eef8; }
h2{ margin:0 0 6px 0; font-weight:700; }
.muted{ color:#9fb0d6; margin-bottom:12px; }
.status{ padding:8px 12px; border-radius:8px; display:inline-block; margin-bottom:12px; font-weight:600; }
.s-on{ background:#08341a; color:#7ee7a1; }
.s-off{ background:#3b0b0b; color:#ff9b9b; }
.s-wait{ background:#3a2f07; color:#ffd97a; }
.s-call{ background:#06283a; color:#7fe0ff; }

.uuid-row{ display:flex; gap:8px; margin-bottom:12px; }
.invite-input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:inherit; }

.controls{ display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.btn{ background:transparent; border:1px solid rgba(255,255,255,0.12); color:inherit; padding:8px 12px; border-radius:10px; cursor:pointer; }
.btn:hover{ transform:translateY(-2px); }
.btn.primary{ background:linear-gradient(90deg,#6ee7b7,#3b82f6); color:#04201a; border:none; }
.btn.accent{ background:linear-gradient(90deg,#7c3aed,#06b6d4); color:white; border:none; }
.btn.danger{ background:linear-gradient(90deg,#ef4444,#f97316); color:white; border:none; }
.btn.small{ padding:6px 8px; font-size:13px; }

.videos{ display:flex; gap:18px; margin-top:12px; }
.vbox{ flex:1; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; }
video{ width:100%; height:260px; background:#000; border-radius:8px; object-fit:cover; }

.logs{ margin-top:14px; max-height:160px; overflow:auto; border-top:1px dashed rgba(255,255,255,0.04); padding-top:10px; }
.log{ font-family:monospace; font-size:13px; color:#cfe8ff; padding:4px 0; }
</style>
