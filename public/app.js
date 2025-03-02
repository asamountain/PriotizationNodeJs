// Initialize the task manager
const taskManager = new TaskManager();

// Create Vue app
const app = Vue.createApp({
  data() {
    return {
      taskManager: taskManager,
      tasks: [],
      newTask: {
        name: '',
        importance: 5,
        urgency: 5,
        description: '',
        done: false
      },
      theme: localStorage.getItem('theme') || 'light'
    };
  },
  computed: {
    activeTasks() {
      return this.tasks.filter(task => !task.done && !task.parentId);
    },
    completedTasks() {
      return this.tasks.filter(task => task.done && !task.parentId);
    },
    incompleteTasks() {
      return this.tasks.filter(task => !task.done);
    },
    tasksByQuadrant() {
      const quadrants = {
        q1: [], // Important & Urgent (Do First)
        q2: [], // Important & Not Urgent (Schedule)
        q3: [], // Not Important & Urgent (Delegate)
        q4: []  // Not Important & Not Urgent (Don't Do)
      };
      
      this.incompleteTasks.forEach(task => {
        if (task.importance > 5 && task.urgency > 5) quadrants.q1.push(task);
        else if (task.importance > 5 && task.urgency <= 5) quadrants.q2.push(task);
        else if (task.importance <= 5 && task.urgency > 5) quadrants.q3.push(task);
        else quadrants.q4.push(task);
      });
      
      return quadrants;
    },
    quadrantStats() {
      return {
        q1: this.tasksByQuadrant.q1.length,
        q2: this.tasksByQuadrant.q2.length,
        q3: this.tasksByQuadrant.q3.length,
        q4: this.tasksByQuadrant.q4.length
      };
    }
  },
  methods: {
    submitTask() {
      if (!this.newTask.name.trim()) {
        taskManager.showNotification('Please enter a task name', 'warning');
        return;
      }
      
      const task = { ...this.newTask };
      
      taskManager.addTask(task)
        .then(response => {
          if (response.success) {
            this.resetForm();
            taskManager.showNotification('Task added successfully', 'success');
          }
        })
        .catch(error => {
          console.error('Error adding task:', error);
          taskManager.showNotification('Failed to add task', 'error');
        });
    },
    resetForm() {
      this.newTask = {
        name: '',
        importance: 5,
        urgency: 5,
        description: '',
        done: false
      };
    },
    getQuadrantName(task) {
      if (task.importance > 5 && task.urgency > 5) return "Q1: Do First";
      if (task.importance > 5 && task.urgency <= 5) return "Q2: Schedule";
      if (task.importance <= 5 && task.urgency > 5) return "Q3: Delegate";
      return "Q4: Don't Do";
    },
    getQuadrantClass(task) {
      if (task.importance > 5 && task.urgency > 5) return "quadrant-badge-q1";
      if (task.importance > 5 && task.urgency <= 5) return "quadrant-badge-q2";
      if (task.importance <= 5 && task.urgency > 5) return "quadrant-badge-q3";
      return "quadrant-badge-q4";
    },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
      localStorage.setItem('theme', this.theme);
    },
    deleteTask(taskId) {
      if (confirm('Are you sure you want to delete this task? This will also delete all subtasks.')) {
        this.taskManager.deleteTask(taskId);
      }
    }
  },
  mounted() {
    // Initialize with the saved theme
    document.documentElement.setAttribute('data-theme', this.theme);
    
    // Listen for task updates from the task manager
    window.addEventListener('tasksUpdated', (event) => {
      this.tasks = event.detail.tasks;
    });
    
    // Initialize task manager and load tasks
    taskManager.init();
  }
});

// Mount the Vue app
app.mount('#app'); 