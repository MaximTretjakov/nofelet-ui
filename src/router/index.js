import { createRouter, createWebHistory } from 'vue-router'
import Caller from '@/views/Caller.vue'
import Callee from '@/views/Callee.vue'

const routes = [
  { path: '/', redirect: '/caller' },
  { path: '/caller', name: 'Caller', component: Caller },
  { path: '/callee', name: 'Callee', component: Callee },
  // invite short link -> redirect to callee with query param for auto-connect
  {
  path: '/invite/:uuid',
  name: 'InviteRedirect',
  beforeEnter: (to, from, next) => {
    const uuid = to.params.uuid
    next(`/callee?uuid=${uuid}`)
  }
},
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
