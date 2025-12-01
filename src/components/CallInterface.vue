<template>
  <div class="call-interface container-fluid p-3">
    <!-- top-left zoom controls -->
    <div class="zoom-controls position-absolute top-0 start-0 m-3 d-flex gap-2">
      <button class="btn btn-light btn-sm shadow-sm" @click="decreaseRemote" title="Уменьшить окно">
        <i class="bi bi-window-dash"></i>
      </button>
      <button class="btn btn-light btn-sm shadow-sm" @click="increaseRemote" title="Увеличить окно">
        <i class="bi bi-window-plus"></i>
      </button>
    </div>

    <!-- error banner (animated) -->
    <transition name="error-slide">
      <div v-if="showError" class="error-banner position-fixed top-0 start-50 translate-middle-x mt-4">
        <div class="d-flex align-items-center p-3">
          <div class="me-3">
            <i class="bi bi-exclamation-triangle-fill fs-4"></i>
          </div>
          <div>
            <div class="fw-bold">{{ errorTitle }}</div>
            <div class="small">{{ errorText }}</div>
          </div>
        </div>
      </div>
    </transition>

    <div class="interface-content row mt-4 gx-3">
      <div class="col-12 mb-3">
        <div class="call-link-section">
          <span class="badge bg-primary">Call link</span>
          <div class="mt-2 call-link p-2 bg-light rounded">
            {{ callLink }}
          </div>
        </div>
      </div>

      <div class="col-12">
        <!-- Video and controls are inside VideoCall component.
             Передаём remoteScale как UI-only prop. -->
        <VideoCall
          ref="videoCall"
          :remote-scale="remoteScale"
          v-bind="$attrs"
          v-on="$listeners"
        />
      </div>

      <div class="col-12 mt-3 d-flex justify-content-center">
        <!-- Controls (equal gaps) -->
        <div class="d-flex gap-3 control-group">
          <button class="btn btn-danger control-btn" @click="hangUp" :disabled="!isCallActive">
            <span class="badge bg-light text-dark me-2">Отбой</span>
            <i class="bi bi-telephone-fill"></i>
          </button>

          <button class="btn btn-success control-btn" v-if="!isCallActive" @click="startCall">
            <span class="badge bg-light text-dark me-2">Звонок</span>
            <i class="bi bi-telephone-forward-fill"></i>
          </button>

          <button class="btn btn-secondary control-btn" @click="toggleMute">
            <span class="badge bg-light text-dark me-2">{{ isMuted ? 'Вкл. звук' : 'Выкл. звук' }}</span>
            <i :class="isMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill'"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import VideoCall from './VideoCall.vue';

export default {
  name: 'CallInterface',
  components: { VideoCall },
  props: {
    // не трогаем логику — эти props/данные могут приходить извне
    callLink: { type: String, default: '' },
    isCallActive: { type: Boolean, default: false },
  },
  data() {
    return {
      // control UI state only
      remoteScale: 1, // 1 = normal, can be scaled between 0.6 .. 1.6
      showError: false,
      errorText: '',
      errorTitle: 'Ошибка',
      _errorTimeout: null,
      // UI state placeholders that mirror logic (не управляют логикой)
      isMuted: false,
    };
  },
  methods: {
    // UI-only zoom handlers
    increaseRemote() {
      this.remoteScale = Math.min(1.6, +(this.remoteScale + 0.2).toFixed(2));
    },
    decreaseRemote() {
      this.remoteScale = Math.max(0.6, +(this.remoteScale - 0.2).toFixed(2));
    },

    // --- кнопки управления (не меняем логику) ---
    startCall() {
      // вызывается внешний метод/логика, поэтому пробрасываем событие
      this.$emit('startCall');
    },
    hangUp() {
      this.$emit('hangUp');
    },
    toggleMute() {
      // пробрасываем событие на логику, но обновляем UI-бейдж
      this.isMuted = !this.isMuted;
      this.$emit('toggleMute', this.isMuted);
    },

    // --- error banner UI ---
    showUIError(title, text) {
      this.errorTitle = title || 'Ошибка';
      this.errorText = text || '';
      this.showError = true;
      if (this._errorTimeout) clearTimeout(this._errorTimeout);
      // 5 сек видимо, потом скрываем
      this._errorTimeout = setTimeout(() => {
        this.showError = false;
      }, 5000);
    },

    // global error handler (UI-only)
    _onWindowError(evtOrMessage, source, lineno, colno, err) {
      let message = '';
      if (typeof evtOrMessage === 'string') {
        message = evtOrMessage;
      } else if (evtOrMessage && evtOrMessage.message) {
        message = evtOrMessage.message;
      } else if (err && err.message) {
        message = err.message;
      } else {
        message = String(evtOrMessage);
      }

      // Specific formatting for device not found
      if (message.includes('Requested device not found') || message.includes('Requested device')) {
        this.showUIError('ERROR Requested device not found', 'Устройство не найдено — проверьте подключение камеры/микрофона.');
      } else {
        this.showUIError('Ошибка', message);
      }
      // не подавляем default — просто показываем баннер
      return false;
    },

    _onUnhandledRejection(evt) {
      const reason = (evt && (evt.reason || evt.detail)) || evt;
      let msg = typeof reason === 'string' ? reason : (reason && reason.message) ? reason.message : JSON.stringify(reason);
      this._onWindowError(msg);
    },
  },
  mounted() {
    // слушаем глобальные ошибки (UI-only)
    window.addEventListener('error', (e) => this._onWindowError(e));
    window.addEventListener('unhandledrejection', (e) => this._onUnhandledRejection(e));
  },
  beforeUnmount() {
    window.removeEventListener('error', (e) => this._onWindowError(e));
    window.removeEventListener('unhandledrejection', (e) => this._onUnhandledRejection(e));
    if (this._errorTimeout) clearTimeout(this._errorTimeout);
  }
};
</script>

<style scoped>
.call-interface {
  min-height: 100vh;
  position: relative;
}

/* zoom buttons block */
.zoom-controls button { width: 40px; height: 40px; }

/* control buttons sizing */
.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 110px;
  height: 50px;
  border-radius: 10px;
}

/* equal gaps handled by .gap-3 on container */

/* error banner */
.error-banner {
  background: linear-gradient(90deg, #ffefef, #ffd2d2);
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
  border-radius: 10px;
  min-width: 320px;
  max-width: 720px;
  z-index: 2000;
  opacity: 1;
}

/* transition */
.error-slide-enter-active {
  animation: slideIn 1s forwards;
}
.error-slide-leave-active {
  animation: slideOut 0.5s forwards;
}
@keyframes slideIn {
  from { transform: translateY(-30px) translateX(-50%); opacity: 0; }
  to   { transform: translateY(0) translateX(-50%); opacity: 1; }
}
@keyframes slideOut {
  from { transform: translateY(0) translateX(-50%); opacity: 1; }
  to   { transform: translateY(-30px) translateX(-50%); opacity: 0; }
}
</style>
