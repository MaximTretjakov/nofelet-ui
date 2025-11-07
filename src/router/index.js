import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Call from '@/views/Call.vue'
import CallReceiver from '@/views/CallReceiver.vue'

const routes = [
  {
    path: '/',
    name: 'Home', 
    component: Home
  },
  {
    path: '/call',
    name: 'Call', 
    component: Call
  },
  {
    path: '/callee',
    name: 'Callee',
    component: CallReceiver
  }
]

const router = createRouter({
  history: createWebHistory('/nofelet-ui/'),
  routes
})

export default router
