import { ref, onUnmounted } from 'vue'

export function useWebRTC(callLink) {
  const localStream = ref(null)
  const remoteStream = ref(null)
  const peerConnection = ref(null)
  const isCallActive = ref(false)
  const ws = ref(null)
  const iceCandidatesQueue = ref([])

  // Извлекаем UUID из callLink
  const getCallUUID = () => {
    if (!callLink) return ''
    // Извлекаем UUID из URL (последняя часть после последнего /)
    const parts = callLink.split('/')
    return parts[parts.length - 1]
  }

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

  const connectSignaling = () => {
    return new Promise((resolve, reject) => {
      try {
        const uuid = getCallUUID()
        // Используем UUID в URL WebSocket
        ws.value = new WebSocket(`ws://localhost:8080/connect/${uuid}`)
        
        ws.value.onopen = () => {
          console.log('Connected to signaling server with UUID:', uuid)
          resolve()
        }
        
        ws.value.onmessage = async (event) => {
          const message = JSON.parse(event.data)
          console.log('Received message:', message.type)
          
          if (message.type === 'offer') {
            await handleOffer(message)
          } else if (message.type === 'answer') {
            await handleAnswer(message)
          } else if (message.type === 'ice-candidate') {
            await handleIceCandidate(message.candidate)
          }
        }
        
        ws.value.onerror = (error) => {
          console.error('Signaling error:', error)
          reject(error)
        }
        
        ws.value.onclose = () => {
          console.log('Disconnected from signaling server')
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  const startLocalStream = async () => {
    try {
      localStream.value = await navigator.mediaDevices.getUserMedia({
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
      return localStream.value
    } catch (error) {
      console.error('Error accessing media devices:', error)
      throw error
    }
  }

  const createPeerConnection = () => {
    peerConnection.value = new RTCPeerConnection(configuration)

    // Add local tracks
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => {
        peerConnection.value.addTrack(track, localStream.value)
      })
    }

    // Handle remote stream
    peerConnection.value.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind)
      if (event.streams && event.streams[0]) {
        remoteStream.value = event.streams[0]
      }
    }

    // Handle ICE candidates
    peerConnection.value.onicecandidate = (event) => {
      if (event.candidate && ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }))
      }
    }

    // Handle connection state
    peerConnection.value.onconnectionstatechange = () => {
      const state = peerConnection.value.connectionState
      console.log('Connection state:', state)
      isCallActive.value = state === 'connected'
      
      if (state === 'failed') {
        console.log('Connection failed, attempting to restart ICE...')
        setTimeout(() => {
          if (peerConnection.value && peerConnection.value.connectionState === 'failed') {
            peerConnection.value.restartIce()
          }
        }, 2000)
      }
    }

    // Handle ICE connection state
    peerConnection.value.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.value.iceConnectionState)
    }

    return peerConnection.value
  }

  const createOffer = async () => {
    if (!peerConnection.value) {
      createPeerConnection()
    }

    try {
      await connectSignaling()
      
      const offer = await peerConnection.value.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      
      await peerConnection.value.setLocalDescription(offer)
      
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
          type: 'offer',
          sdp: offer.sdp
        }))
      }
      
      return offer
    } catch (error) {
      console.error('Error creating offer:', error)
      throw error
    }
  }

  const handleOffer = async (offer) => {
    if (!peerConnection.value) {
      createPeerConnection()
    }

    try {
      await peerConnection.value.setRemoteDescription(offer)
      
      // Process queued ICE candidates
      if (iceCandidatesQueue.value.length > 0) {
        for (const candidate of iceCandidatesQueue.value) {
          await peerConnection.value.addIceCandidate(candidate)
        }
        iceCandidatesQueue.value = []
      }
    } catch (error) {
      console.error('Error handling offer:', error)
      throw error
    }
  }

  const createAnswer = async () => {
    if (!peerConnection.value) {
      throw new Error('No peer connection for creating answer')
    }

    try {
      const answer = await peerConnection.value.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      
      await peerConnection.value.setLocalDescription(answer)
      
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
          type: 'answer',
          sdp: answer.sdp
        }))
      }
      
      return answer
    } catch (error) {
      console.error('Error creating answer:', error)
      throw error
    }
  }

  const handleAnswer = async (answer) => {
    if (peerConnection.value) {
      try {
        await peerConnection.value.setRemoteDescription(answer)
        
        // Process queued ICE candidates
        if (iceCandidatesQueue.value.length > 0) {
          for (const candidate of iceCandidatesQueue.value) {
            await peerConnection.value.addIceCandidate(candidate)
          }
          iceCandidatesQueue.value = []
        }
      } catch (error) {
        console.error('Error handling answer:', error)
        throw error
      }
    }
  }

  const handleIceCandidate = async (candidate) => {
    if (!peerConnection.value) {
      iceCandidatesQueue.value.push(candidate)
      return
    }

    try {
      if (peerConnection.value.remoteDescription) {
        await peerConnection.value.addIceCandidate(candidate)
      } else {
        iceCandidatesQueue.value.push(candidate)
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }

  const hangUp = () => {
    if (peerConnection.value) {
      peerConnection.value.close()
      peerConnection.value = null
    }
    
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop())
      localStream.value = null
    }
    
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    
    remoteStream.value = null
    isCallActive.value = false
    iceCandidatesQueue.value = []
  }

  onUnmounted(() => {
    hangUp()
  })

  return {
    localStream,
    remoteStream,
    isCallActive,
    connectSignaling,
    startLocalStream,
    createPeerConnection,
    createOffer,
    createAnswer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    hangUp
  }
}