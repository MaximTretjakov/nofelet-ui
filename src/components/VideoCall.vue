<template>
  <div class="video-call d-flex flex-column align-items-center">
    <div class="video-grid d-flex w-100 justify-content-center gap-3">
      <!-- left small local video -->
      <div class="local-wrap position-relative">
        <span class="badge overlay-badge position-absolute top-0 start-0 m-2">Local</span>
        <video
          v-if="localStream"
          ref="localVideo"
          autoplay
          muted
          playsinline
          class="local-video rounded"
        ></video>
        <div v-else class="local-placeholder rounded d-flex align-items-center justify-content-center">
          <i class="bi bi-person-circle fs-2"></i>
        </div>
      </div>

      <!-- right remote video (scalable) -->
      <div class="remote-wrap position-relative">
        <span class="badge overlay-badge position-absolute top-0 start-0 m-2">Remote</span>
        <div class="remote-video-frame rounded">
          <video
            v-if="remoteStream"
            ref="remoteVideo"
            autoplay
            playsinline
            class="remote-video rounded"
            :style="remoteStyle"
          ></video>
          <div v-else class="remote-placeholder rounded d-flex align-items-center justify-content-center">
            <i class="bi bi-display-fill fs-1"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "VideoCall",
  props: {
    remoteScale: { type: Number, default: 1 }
  },
  data() {
    return {
      localStream: null,
      remoteStream: null
    };
  },
  computed: {
    remoteStyle() {
      // масштабируем видео по центру
      const scale = this.remoteScale || 1;
      return {
        transform: `scale(${scale})`,
        transition: 'transform 250ms ease',
        'transform-origin': 'center center',
      };
    }
  },
  mounted() {
    // не меняем логику — компонент предполагает,
    // что кто-то (родитель/логика) назначит this.$refs.localVideo.srcObject и remote.
    // Здесь только эстетика / layout.

    // Если поток был установлен извне (в логике), то local/remote video подключится через refs.
    // Для совместимости можем попытаться прочитать поток из ref, но не меняем логику.
    try {
      if (this.$refs.localVideo && this.$refs.localVideo.srcObject) {
        this.localStream = this.$refs.localVideo.srcObject;
      }
      if (this.$refs.remoteVideo && this.$refs.remoteVideo.srcObject) {
        this.remoteStream = this.$refs.remoteVideo.srcObject;
      }
    } catch (e) {
      // ничего не делаем — это UI-only
    }
  }
};
</script>

<style scoped>
.video-grid {
  max-width: 1200px;
  align-items: flex-start;
}

/* left small video */
.local-wrap {
  width: 260px;
}
.local-video {
  width: 100%;
  height: 180px;
  object-fit: cover;
}
.local-placeholder {
  width: 100%;
  height: 180px;
  background: #f8f9fa;
}

/* remote video area (больше) */
.remote-wrap {
  flex: 1 1 auto;
  min-width: 440px;
}
.remote-video-frame {
  width: 100%;
  min-height: 320px;
  height: 360px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  will-change: transform;
}
.remote-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg,#111,#333);
  color: #fff;
}

/* badges */
.overlay-badge {
  font-size: 0.75rem;
  z-index: 10;
}

/* responsive adjustments */
@media (max-width: 900px) {
  .video-grid { flex-direction: column; align-items: center; }
  .local-wrap { width: 60%; }
  .remote-wrap { width: 100%; min-width: 0; }
  .remote-video-frame { height: 240px; }
}
</style>
