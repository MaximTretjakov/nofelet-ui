<template>
  <div class="video-call">
    
    <div class="video-container">
      <video 
        v-if="localStream"
        ref="localVideo" 
        autoplay 
        muted 
        playsinline
        class="local-video"
      ></video>
      <video 
        v-if="remoteStream"
        ref="remoteVideo" 
        autoplay 
        playsinline
        class="remote-video"
      ></video>
    </div>
    
    <div v-if="!localStream && !remoteStream" class="placeholder">
      Video will appear here when call starts
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { useWebRTC } from '../composables/useWebRTC'

export default {
  name: 'VideoCall',
  props: {
    callLink: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const localVideo = ref(null)
    const remoteVideo = ref(null)
    
    const {
      localStream,
      remoteStream,
      startLocalStream,
      createOffer,
      hangUp
    } = useWebRTC(props.callLink)

    const startVideo = async () => {
      try {
        await startLocalStream()
        await createOffer()
      } catch (error) {
        console.error('Failed to start video call:', error)
        alert('Cannot start video call. Please check camera and microphone permissions.')
      }
    }

    const stopVideo = () => {
      hangUp()
    }

    watch(localStream, (newStream) => {
      if (newStream && localVideo.value) {
        localVideo.value.srcObject = newStream
      } else if (localVideo.value) {
        localVideo.value.srcObject = null
      }
    })

    watch(remoteStream, (newStream) => {
      if (newStream && remoteVideo.value) {
        remoteVideo.value.srcObject = newStream
      } else if (remoteVideo.value) {
        remoteVideo.value.srcObject = null
      }
    })

    onMounted(() => {
      if (localStream.value && localVideo.value) {
        localVideo.value.srcObject = localStream.value
      }
      if (remoteStream.value && remoteVideo.value) {
        remoteVideo.value.srcObject = remoteStream.value
      }
    })

    return {
      localVideo,
      remoteVideo,
      localStream,
      remoteStream,
      startVideo,
      stopVideo
    }
  }
}
</script>

<style scoped>
.video-call {
  padding: 30px 50px 160px;
  min-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.logo-corner {
  position: absolute;
  top: 30px;
  left: 50px;
  font-size: 24px;
  font-weight: 300;
  color: #000;
  letter-spacing: 1px;
}

.video-container {
  width: 100%;
  max-width: 1200px;
  margin-bottom: 30px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.local-video,
.remote-video {
  width: 100%;
  height: 400px;
  background: #000;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid #e0e0e0;
}

.placeholder {
  width: 100%;
  max-width: 800px;
  height: 400px;
  background: #e0e0e0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-weight: 300;
  margin-bottom: 30px;
  border: 2px dashed #ccc;
}

@media (max-width: 768px) {
  .video-call {
    padding: 20px 20px 160px;
  }
  
  .logo-corner {
    top: 20px;
    left: 20px;
    font-size: 20px;
  }
  
  .video-container {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .local-video,
  .remote-video {
    height: 300px;
  }
}
</style>