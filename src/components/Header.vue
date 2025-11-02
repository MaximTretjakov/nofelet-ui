<template>
  <header class="header">
    <div class="logo" v-if="$route.path !== '/'">
      nofelet
    </div>
    <div v-else class="logo-placeholder"></div>
  </header>
</template>

<script>
export default {
  name: 'Header'
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30px;
  background-color: #f7f7f8;
  height: 120px;
  box-sizing: border-box;
}

.logo {
  font-size: 24px;
  font-weight: 300;
  color: #000;
}

.logo-placeholder {
  width: 1px; /* Невидимый placeholder чтобы навигация оставалась справа */
}
</style>