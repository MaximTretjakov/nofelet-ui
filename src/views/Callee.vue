<template>
  <div class="call-container">
    <div class="videos">
      <video ref="localVideo" autoplay muted playsinline></video>
      <video ref="remoteVideo" autoplay playsinline></video>
    </div>

    <div class="controls">
      <button @click="disconnect" :disabled="!connected" class="btn danger">Hang up</button>

      <div class="copy-wrapper">
        <button @click="copyInvite" @mouseleave="hideCopied" class="btn secondary">
          Copy Invite
        </button>
        <small v-if="copied" class="copied-label">Invite link copied</small>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      pc: null,
      ws: null,
      copied: false,
      connected: false,
      uuid: new URLSearchParams(window.location.search).get('uuid'),
    };
  },
  computed: {
    inviteUrl() {
      return `${window.location.origin}/callee?uuid=${this.uuid}`;
    }
  },
  async mounted() {
    await this.initConnection();
    this.connectWs();
  },
  methods: {
    async initConnection() {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      this.pc.ontrack = (event) => {
        this.$refs.remoteVideo.srcObject = event.streams[0];
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.ws.send(JSON.stringify({ ice: event.candidate }));
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.$refs.localVideo.srcObject = stream;
      stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
    },

    connectWs() {
      this.ws = new WebSocket(`wss://nofelet.duckdns.org:8443/connect/${this.uuid}`);

      this.ws.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.offer) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.ws.send(JSON.stringify({ answer }));
          this.connected = true;
        }

        if (data.ice) {
          await this.pc.addIceCandidate(data.ice);
        }
      };
    },

    disconnect() {
      if (this.ws) this.ws.close();
      if (this.pc) this.pc.close();
      this.connected = false;
    },

    async copyInvite() {
      await navigator.clipboard.writeText(this.inviteUrl);
      this.copied = true;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => (this.copied = false), 3000);
    },

    hideCopied() {
      this.copied = false;
    }
  }
};
</script>

<style scoped>
.call-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px;
  font-family: 'Inter', sans-serif;
}

.videos {
  display: flex;
  gap: 20px;
}

video {
  width: 360px;
  height: 240px;
  background: #1a1d21;
  border-radius: 12px;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.copy-wrapper {
  position: relative;
}

.copied-label {
  position: absolute;
  top: 40px;
  left: 0;
  font-size: 12px;
  color: #2eb67d;
}

.btn {
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  font-size: 14px;
}

.primary {
  background: #4a154b;
  color: white;
}

.secondary {
  background: #1164a3;
  color: white;
}

.danger {
  background: #e01e5a;
  color: white;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>

