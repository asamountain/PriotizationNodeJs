import { TaskManager } from './taskManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize task manager
  const taskManager = new TaskManager();
  taskManager.init();

  // Initialize Vue application
  const app = window.Vue.createApp({
    data() {
      return {
        // Tasks data
        tasks: [],
        activeTasks: [],
        completedTasks: [],
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        selectedTaskId: null,
        
        // UI state
        isDarkTheme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        showCompletedSubtasks: false,
        taskSectionOpen: {
          active: true,
          completed: true
        },
        
        // Stats data
        showStatsView: false,
        theme: 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        
        // Subtask modal
        showSubtaskModal: false,
        selectedParentId: null,
        newSubtask: {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: ''
        },
        
        // Edit modal
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null
        },
        
        // New properties to fix errors
        showCompletedTasks: false,
        newTask: {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: null
        },
        
        // Computed properties for templates
        averageCompletionTime: '0 days',
        mostProductiveDay: 'None',
      };
    },
    computed: {
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      },
      hasCompletedTasks() {
        return this.completedTasks && this.completedTasks.length > 0;
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
      
      handleTaskClick(taskId) {
        console.log('Handling task click:', taskId);
        taskManager.highlightTask(taskId);
      },
      
      // Subtask management
      getSubtasksForTask(taskId) {
        return this.tasks.filter(task => task.parent_id === taskId);
      },
      
      getCompletedSubtaskCount(taskId) {
        return this.getSubtasksForTask(taskId).filter(task => task.done).length;
      },
      
      showAddSubtaskForm(taskId) {
        this.selectedTaskId = taskId;
        this.showSubtaskModal = true;
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: null,
          parent_id: taskId
        };
      },
      
      closeSubtaskModal() {
        this.showSubtaskModal = false;
        this.selectedTaskId = null;
      },
      
      addSubtask() {
        if (!this.newSubtask.name || !this.selectedTaskId) {
          console.error('Invalid subtask data or missing parent ID');
          return;
        }
        
        if (taskManager) {
          const subtaskData = {
            name: this.newSubtask.name,
            importance: this.newSubtask.importance,
            urgency: this.newSubtask.urgency,
            due_date: this.newSubtask.due_date
          };
          
          taskManager.addSubtask(subtaskData, this.selectedTaskId);
          this.closeSubtaskModal();
        }
      },
      
      selectTask(task) {
        this.selectedTaskId = task.id;
        if (taskManager) {
          // Focus on this task in the chart
          taskManager.focusOnTask(task.id);
          
          // Also call handleTaskClick to focus the dot in the chart
          const event = { currentTarget: { dataset: { taskId: task.id } } };
          taskManager.handleTaskClick(event);
        }
      },
      
      // Edit task/subtask management
      editSubtask(subtask) {
        this.editingSubtask = {
          id: subtask.id,
          name: subtask.name,
          importance: subtask.importance,
          urgency: subtask.urgency,
          parent_id: subtask.parent_id,
          originalParentId: subtask.parent_id
        };
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        const updatedSubtask = {
          id: this.editingSubtask.id,
          name: this.editingSubtask.name,
          importance: this.editingSubtask.importance,
          urgency: this.editingSubtask.urgency,
          parent_id: this.editingSubtask.parent_id
        };
        
        taskManager.updateSubtask(updatedSubtask);
        this.showEditForm = false;
      },
      
      cancelEdit() {
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          originalParentId: null
        };
      },
      
      // UI helpers
      toggleShowCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
        localStorage.setItem('showCompletedSubtasks', this.showCompletedSubtasks);
      },
      
      toggleTaskSection(section) {
        this.taskSectionOpen[section] = !this.taskSectionOpen[section];
      },
      
      toggleCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
        
        // Toggle the 'hidden' class on completed subtasks
        document.querySelectorAll('.subtask.completed').forEach(el => {
          if (this.showCompletedSubtasks) {
            el.classList.remove('hidden');
          } else {
            el.classList.add('hidden');
          }
        });
      },
      
      updateTasks(tasks) {
        console.log('Vue app received tasks update:', tasks.length, 'tasks');
        this.tasks = tasks;
      },
      
      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
      },
      
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
    }
  });
  
  // Mount Vue app
  app.mount('#app');
}); 