import { TaskManager } from './taskManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize task manager
  const taskManager = new TaskManager();
  taskManager.init();

  // Initialize Vue application
  const app = Vue.createApp({
    data() {
      return {
        // Task data
        tasks: [],
        activeTasks: [],
        completedTasks: [],
        selectedTaskId: null,
        
        // Form fields
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        
        // UI states
        isDarkTheme: localStorage.getItem('darkTheme') === 'true' || false,
        showCompletedTasks: false,
        showCompletedSubtasks: localStorage.getItem('showCompletedSubtasks') === 'true' || false,
        
        // Stats data
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        tasksByQuadrant: {},
        quadrantLabels: {
          q1: 'Do First',
          q2: 'Schedule',
          q3: 'Delegate',
          q4: 'Don\'t Do'
        },
        
        // Computed properties for templates
        averageCompletionTime: '0 days',
        mostProductiveDay: 'None',
      };
    },
    computed: {
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      }
    },
    methods: {
      // Theme handling
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('darkTheme', this.isDarkTheme);
        document.querySelector('body').classList.toggle('dark-theme', this.isDarkTheme);
        taskManager.updateChartColors();
      },
      
      // Task submission
      submitTask() {
        if (!this.taskName.trim()) {
          taskManager.showNotification('Please enter a task name', 'warning');
          return;
        }
        
        const taskData = {
          name: this.taskName.trim(),
          importance: parseInt(this.taskImportance),
          urgency: parseInt(this.taskUrgency),
          parent_id: null
        };
        
        taskManager.addTask(taskData)
          .then(response => {
            if (response) {
              taskManager.showNotification('Task added successfully', 'success');
              this.taskName = '';
              this.taskImportance = 5;
              this.taskUrgency = 5;
            }
          })
          .catch(error => {
            taskManager.showNotification('Failed to add task', 'error');
            console.error('Error adding task:', error);
          });
      },
      
      // Task actions
      toggleTaskDone(task) {
        taskManager.toggleDone(task.id);
      },
      
      deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
          taskManager.deleteTask(taskId);
        }
      },
      
      // Subtask management
      getSubtasksForTask(taskId) {
        return this.tasks.filter(task => task.parent_id === taskId);
      },
      
      getCompletedSubtaskCount(taskId) {
        return this.getSubtasksForTask(taskId).filter(task => task.done).length;
      },
      
      // UI helpers
      toggleShowCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
        localStorage.setItem('showCompletedSubtasks', this.showCompletedSubtasks);
      },
      
      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
      }
    },
    mounted() {
      // Apply theme from localStorage
      document.querySelector('body').classList.toggle('dark-theme', this.isDarkTheme);
      
      // Listen for task updates from TaskManager
      window.addEventListener('tasksUpdated', (event) => {
        const tasks = event.detail.tasks;
        this.tasks = tasks || [];
        
        // Filter active and completed tasks
        this.activeTasks = this.tasks.filter(task => !task.done && !task.parent_id);
        this.completedTasks = this.tasks.filter(task => task.done && !task.parent_id);
        
        // Calculate quadrant statistics
        this.calculateQuadrantStats();
      });
      
      // Listen for task selection events
      window.addEventListener('taskSelected', (event) => {
        this.selectedTaskId = event.detail.task.id;
      });
      
      // Set Vue app reference in TaskManager
      taskManager.setVueApp(this);
    },
    methods: {
      calculateQuadrantStats() {
        // Reset counters
        this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
        
        // Filter only parent tasks
        const parentTasks = this.tasks.filter(task => !task.parent_id);
        
        // Count tasks per quadrant
        parentTasks.forEach(task => {
          const quadrant = this.getQuadrantForTask(task);
          this.quadrantStats[quadrant]++;
        });
        
        // Calculate additional statistics (not implemented fully)
        this.calculateAdditionalStatistics();
      },
      
      getQuadrantForTask(task) {
        const highImportance = task.importance > 5;
        const highUrgency = task.urgency > 5;
        
        if (highImportance && highUrgency) return 'q1';
        if (highImportance && !highUrgency) return 'q2';
        if (!highImportance && highUrgency) return 'q3';
        return 'q4';
      },
      
      calculateAdditionalStatistics() {
        // These would be calculated from task data in a real implementation
        this.averageCompletionTime = '2.5 days';
        this.mostProductiveDay = 'Wednesday';
      }
    }
  });
  
  // Mount Vue app
  app.mount('#app');
}); 