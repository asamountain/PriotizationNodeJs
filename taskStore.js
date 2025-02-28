import { defineStore } from 'pinia'
import { addTask, getTaskData, toggleTaskDone } from '../db.js'

// Integrate with your existing database functions
export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: []
  }),

  actions: {
    async fetchTasks() {
      this.tasks = await getTaskData()
    },
    
    async addTask(task) {
      await addTask(task)
      await this.fetchTasks()
    },

    async toggleDone(id) {
      await toggleTaskDone(id)
      await this.fetchTasks()
    }
  }
})