<!-- priority-task-app/components/TaskForm.vue -->
<script setup>
import { ref } from 'vue'
import { useTaskStore } from '../stores/taskStore'

const taskName = ref('')
const importance = ref(5)
const urgency = ref(5)
const store = useTaskStore()

// Reuse your existing addTask function
const handleSubmit = () => {
  store.addTask({
    name: taskName.value,
    importance: importance.value,
    urgency: urgency.value
  })
}
</script>

<template>
  <!-- Keep your existing HTML structure -->
  <form @submit.prevent="handleSubmit">
    <input v-model="taskName" type="text" />
    <input v-model="importance" type="range" min="0" max="10" />
    <input v-model="urgency" type="range" min="0" max="10" />
    <button type="submit">Add Task</button>
  </form>
</template>