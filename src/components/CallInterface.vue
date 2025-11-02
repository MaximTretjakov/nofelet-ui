<template>
  <div class="call-interface">
    <div class="control-bar"></div>
    <div class="interface-content">
      <div class="call-link-section">
        <div class="call-link">
          {{ callLink }}
        </div>
      </div>
      <div class="controls">
        <button 
          v-if="!isCallActive"
          @click="startCall" 
          class="control-btn"
        >
          <span class="btn-text">start</span>
        </button>
        <button 
          v-else
          @click="hangUp" 
          class="control-btn hangup"
        >
          <span class="btn-text">hang up</span>
        </button>
      </div>
      <div class="spacer"></div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'CallInterface',
  props: {
    callLink: {
      type: String,
      required: true
    }
  },
  emits: ['start-call', 'hang-up'],
  setup(props, { emit }) {
    const isCallActive = ref(false)

    const startCall = () => {
      isCallActive.value = true
      emit('start-call')
    }

    const hangUp = () => {
      isCallActive.value = false
      emit('hang-up')
    }

    return {
      isCallActive,
      startCall,
      hangUp
    }
  }
}
</script>

<style scoped>
.call-interface {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #f7f7f8;
  padding: 0 50px;
}

.control-bar {
  width: 100%;
  height: 2px;
  background: #000;
  margin: 0 auto;
}

.interface-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
}

.call-link-section {
  flex: 1;
}

.call-link {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #333;
  background: #f9f9f9;
  padding: 8px 12px;
  border-radius: 4px;
  word-break: break-all;
  border: 1px solid #e0e0e0;
  display: inline-block;
  max-width: 400px;
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 0;
}

.spacer {
  flex: 1;
}

.control-btn {
  width: 80px;
  height: 80px;
  border: 1px solid #000;
  border-radius: 50%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-btn:hover {
  background: #000;
}

.control-btn:hover .btn-text {
  color: #f7f7f8;
}

.hangup {
  background: #ff4444;
  border-color: #ff4444;
}

.hangup:hover {
  background: #cc0000;
  border-color: #cc0000;
}

.hangup .btn-text {
  color: white;
}

.btn-text {
  font-size: 14px;
  font-weight: 300;
  color: #000;
  transition: color 0.3s ease;
}

@media (max-width: 768px) {
  .call-interface {
    padding: 0 20px;
  }
  
  .interface-content {
    flex-direction: column;
    gap: 15px;
    padding: 15px 0;
  }
  
  .call-link-section {
    width: 100%;
    text-align: center;
    order: 2;
  }
  
  .call-link {
    max-width: 100%;
    font-size: 12px;
  }
  
  .controls {
    order: 1;
    width: 100%;
    justify-content: center;
  }
  
  .spacer {
    display: none;
  }
  
  .control-btn {
    width: 70px;
    height: 70px;
  }
  
  .btn-text {
    font-size: 12px;
  }
}
</style>