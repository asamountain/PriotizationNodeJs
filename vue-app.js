import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Create a Vue app instance
const app = createApp({})
const pinia = createPinia()
app.use(pinia)

// Mount Vue where needed
export function initVue() {
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('task-form')) {
      app.mount('#task-form')
    }
    if (document.getElementById('task-list')) {
      app.mount('#task-list')
    }
    if (document.getElementById('priority-chart')) {
      app.mount('#priority-chart')
    }
  })
}