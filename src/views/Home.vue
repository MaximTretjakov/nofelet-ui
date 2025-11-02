<template>
  <div class="home">
    <!-- Логотип nofelet и стрелка -->
    <div class="logo-section">
      <div class="center-logo">
        nofelet
      </div>
      
      <!-- Анимированная кнопка прокрутки ПОД логотипом -->
      <div class="scroll-indicator" @click="scrollToCallTypes">
        <div class="arrow"></div>
      </div>
    </div>
    
    <!-- Блок выбора типа звонка -->
    <div class="call-types-section" ref="callTypesSection">
      <!-- Блок P2P -->
      <div class="call-type-block p2p-block">
        <h2 class="call-type-title">P2P</h2>
        <p class="call-type-description">
          person to person • в звонке участвуют не более двух человек
        </p>
        <div class="beta-badge">beta</div>
        <button class="start-btn" @click="startP2PCall">
          start
        </button>
      </div>
      
      <!-- Блок Conference -->
      <div class="call-type-block conference-block disabled">
        <h2 class="call-type-title">Conference</h2>
        <p class="call-type-description">
          звонок конференция<br>
          в звонке участвуют более 2 человек
        </p>
        <div class="progress-badge">in progress</div>
        <button class="start-btn disabled" disabled>
          start
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  methods: {
    scrollToCallTypes() {
      this.$refs.callTypesSection.scrollIntoView({ 
        behavior: 'smooth' 
      })
    },
    startP2PCall() {
      this.$router.push('/call')
    }
  }
}
</script>

<style scoped>
.home {
  min-height: 200vh;
  background-color: #f7f7f8;
  position: relative;
}

.logo-section {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
}

.center-logo {
  font-size: 48px;
  font-weight: 300;
  color: #000;
  letter-spacing: 2px;
  margin-bottom: 40px;
}

.scroll-indicator {
  cursor: pointer;
  animation: bounce 2s infinite;
}

.arrow {
  width: 30px;
  height: 30px;
  border: 2px solid #000;
  border-left: none;
  border-top: none;
  transform: rotate(45deg);
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.call-types-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 100px 50px;
  min-height: 100vh;
  gap: 30px; /* Базовое расстояние */
}

/* Адаптивное расстояние на основе диагонали */
@media (min-width: 1200px) and (min-height: 800px) {
  .call-types-section {
    gap: 40px;
  }
}

@media (min-width: 1600px) and (min-height: 900px) {
  .call-types-section {
    gap: 50px;
  }
}

@media (min-width: 1920px) and (min-height: 1080px) {
  .call-types-section {
    gap: 60px;
  }
}

.call-type-block {
  flex: 1;
  max-width: 500px;
  padding: 40px 30px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.p2p-block {
  margin-right: auto;
  margin-left: 50px;
}

.conference-block {
  margin-left: auto;
  margin-right: 50px;
}

.call-type-block.disabled {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #888;
}

.call-type-title {
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 24px;
  font-weight: bold;
  color: #000;
  margin-bottom: 20px;
  text-align: center;
}

.call-type-block.disabled .call-type-title {
  color: #888;
}

.call-type-description {
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #666;
  margin-bottom: 15px;
  text-align: center;
}

.call-type-block.disabled .call-type-description {
  color: #999;
}

.beta-badge {
  display: inline-block;
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 12px;
  font-weight: bold;
  color: #ff6b35;
  background: #fff0eb;
  padding: 4px 12px;
  border: 1px solid #ff6b35;
  border-radius: 12px;
  margin-bottom: 25px; /* Увеличиваем отступ для кнопки start */
  text-transform: uppercase;
  letter-spacing: 1px;
}

.progress-badge {
  display: inline-block;
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 12px;
  font-weight: bold;
  color: #4a90e2;
  background: #f0f7ff;
  padding: 4px 12px;
  border: 1px solid #4a90e2;
  border-radius: 12px;
  margin-bottom: 25px; /* Увеличиваем отступ для кнопки start */
  text-transform: lowercase;
  letter-spacing: 1px;
}

.start-btn {
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 16px;
  font-weight: 300;
  color: #000;
  background: transparent;
  border: 1px solid #000;
  padding: 12px 40px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: lowercase;
  width: auto;
  min-width: 120px;
}

.start-btn:hover {
  background: #000;
  color: #f7f7f8;
}

.start-btn.disabled {
  color: #999;
  border-color: #ccc;
  background: #f0f0f0;
  cursor: not-allowed;
}

.start-btn.disabled:hover {
  background: #f0f0f0;
  color: #999;
}

@media (max-width: 768px) {
  .call-types-section {
    flex-direction: column;
    padding: 50px 20px;
    gap: 30px;
  }
  
  .p2p-block,
  .conference-block {
    margin: 0;
    max-width: 100%;
  }
  
  .call-type-title {
    font-size: 20px;
  }
  
  .call-type-description {
    font-size: 14px;
  }
  
  .center-logo {
    font-size: 36px;
    margin-bottom: 30px;
  }
  
  .beta-badge,
  .progress-badge {
    font-size: 11px;
    padding: 3px 10px;
    margin-bottom: 20px; /* Меньший отступ на мобильных */
  }
  
  .start-btn {
    padding: 10px 30px;
    font-size: 14px;
  }
}
</style>