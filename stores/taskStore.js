import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: []
  }),
  
  actions: {
    async fetchTasks() {
      // We'll update this from the database side
      this.tasks = []
    }
  }
})