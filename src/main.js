import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

console.log('🔧 Router instance:', router)

const app = createApp(App)
app.use(router)
app.mount('#app')

console.log('✅ App mounted')