import { TaskManager } from './taskManager.js';
import { ChartVisualization } from './modules/chartVisualization.js';
import { TaskOperations } from './modules/taskOperations.js';
import { TaskListManager } from './modules/taskListManager.js';

// Define these variables at the top level so they can be exported
let chartVisualization = null;
let taskOperations = null;
let taskListManager = null;

// Wait for DOM and resources to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app');
  
  // Make sure Vuetify is properly loaded
  if (typeof Vuetify === 'undefined') {
    console.error('Vuetify not loaded! Check your script imports.');
    document.body.innerHTML = '<div style="color:red;padding:20px;">Error: Vuetify library not loaded. Please check your internet connection and reload the page.</div>';
    return;
  }
  
  // Create Vuetify instance
  const vuetify = Vuetify.createVuetify({
    theme: {
      defaultTheme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
      themes: {
        light: {
          colors: {
            primary: '#1976D2',
            secondary: '#9C27B0',
            accent: '#FF4081',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
            success: '#4CAF50',
          },
        },
        dark: {
          colors: {
            primary: '#2196F3',
            secondary: '#BB86FC',
            accent: '#03DAC6',
            error: '#CF6679',
            warning: '#FFB74D',
            info: '#64B5F6',
            success: '#81C784',
          },
        },
      },
    },
  });
  
  // Initialize modules - assign to the global variables we defined earlier
  chartVisualization = new ChartVisualization();
  taskOperations = new TaskOperations();
  taskListManager = new TaskListManager();
  
  // Create Vue app with Vuetify
  const app = Vue.createApp({
    data() {
      return {
        tasks: [],
        activeTasks: [],
        completedTasks: [],
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        taskLink: '',
        taskDueDate: null,
        isDarkTheme: localStorage.getItem('isDarkTheme') === 'true',
        theme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        newSubtask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        },
        showSubtaskModal: false,
        parentId: null,
        showCompletedSubtasks: true,
        taskSectionOpen: {
          active: true,
          completed: false
        },
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        },
        possibleParents: [],
        snackbar: {
          show: false,
          text: '',
          color: 'primary',
          timeout: 3000
        },
        socket: null
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
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.theme = this.isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('isDarkTheme', this.isDarkTheme);
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Update chart colors
        if (chartVisualization && typeof chartVisualization.updateChartColors === 'function') {
          chartVisualization.updateChartColors();
        }
      },
      
      submitTask() {
        if (!this.taskName) return;
        
        const taskData = {
          name: this.taskName,
          importance: this.taskImportance,
          urgency: this.taskUrgency,
          link: this.taskLink || null,
          due_date: this.taskDueDate || null
        };
        
        taskOperations.addTask(taskData);
        
        // Reset form
              this.taskName = '';
              this.taskImportance = 5;
              this.taskUrgency = 5;
        this.taskLink = '';
        this.taskDueDate = null;
      },
      
      toggleTaskDone(task) {
        taskOperations.toggleDone(task.id);
      },
      
      deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
          taskOperations.deleteTask(taskId);
        }
      },
      
      getSubtasksForTask(taskId) {
        const subtasks = this.tasks.filter(task => task.parent_id === taskId);
        
        // Debug logging for subtasks with links
        subtasks.forEach(subtask => {
          if (subtask.link) {
            console.log(`UI: Displaying subtask ${subtask.id} with link: ${subtask.link}`);
          }
        });
        
        return subtasks;
      },
      
      showAddSubtaskForm(taskId) {
        this.parentId = taskId;
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
        this.showSubtaskModal = true;
      },
      
      closeSubtaskModal() {
        this.showSubtaskModal = false;
        this.parentId = null;
      },
      
      addSubtask() {
        if (!this.newSubtask.name || !this.parentId) return;
        
        taskOperations.addSubtask(this.newSubtask, this.parentId);
        
        this.showSubtaskModal = false;
        this.parentId = null;
        
        // Reset the newSubtask object
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      selectTask(task) {
        if (chartVisualization) {
          chartVisualization.focusOnTask(task.id);
        }
      },
      
      editSubtask(subtask) {
        this.editingSubtask = { ...subtask };
        this.possibleParents = this.activeTasks;
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name) return;
        
        console.log("UI: Saving subtask edit:");
        console.log("UI: Subtask ID:", this.editingSubtask.id);
        console.log("UI: Subtask link before saving:", this.editingSubtask.link);
        
        // Ensure link is properly formatted
        if (this.editingSubtask.link && typeof this.editingSubtask.link === 'string') {
          // Add http:// prefix if missing
          if (!/^https?:\/\//i.test(this.editingSubtask.link)) {
            this.editingSubtask.link = 'http://' + this.editingSubtask.link;
            console.log("UI: Added http:// prefix to link:", this.editingSubtask.link);
          }
        }
        
        console.log("UI: Final subtask link value being sent:", this.editingSubtask.link);
        taskOperations.updateSubtask(this.editingSubtask);
        
        this.showNotification("Saving subtask with link: " + (this.editingSubtask.link || "none"), "info");
        
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null
        };
      },
      
      cancelEdit() {
        this.showEditForm = false;
      },
      
      editTask(task) {
        this.editingTask = { ...task };
        this.showTaskEditForm = true;
      },
      
      saveTaskEdit() {
        if (!this.editingTask.name) return;
        
        taskOperations.editTask(this.editingTask);
        
        this.showTaskEditForm = false;
        this.editingTask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      cancelTaskEdit() {
        this.showTaskEditForm = false;
      },
      
      toggleTaskSection(section) {
        this.taskSectionOpen[section] = !this.taskSectionOpen[section];
      },
      
      toggleCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
      },
      
      updateTasks(tasks) {
        this.tasks = tasks;
        this.activeTasks = tasks.filter(task => !task.done && !task.parent_id);
        this.completedTasks = tasks.filter(task => task.done && !task.parent_id);
        
        // Debug: Log information about tasks with links
        console.log('Tasks with links:');
        tasks.forEach(task => {
          if (task.link) {
            console.log(`Task ${task.id} (${task.name}): ${task.link}`);
          }
        });
        
        // Debug: Count of subtasks with links
        const subtasks = tasks.filter(task => task.parent_id);
        const subtasksWithLinks = subtasks.filter(task => task.link);
        console.log(`Subtasks with links: ${subtasksWithLinks.length} out of ${subtasks.length}`);
        if (subtasksWithLinks.length > 0) {
          console.log('Subtasks with links:', subtasksWithLinks);
        }
      },
      
      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      },
      
      formatLinkDisplay(url) {
        if (!url) return 'No link';
        try {
          console.log('Formatting link:', url); // Debug logging
          const urlObj = new URL(url);
          // Show domain and first part of path if exists
          let displayText = urlObj.hostname;
          if (urlObj.pathname && urlObj.pathname !== '/') {
            // Add first part of path if not too long
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
              const firstPart = pathParts[0];
              if (firstPart.length < 10) {
                displayText += '/' + firstPart;
                if (pathParts.length > 1) {
                  displayText += '/...';
                }
              }
            }
          }
          return displayText || url;
        } catch (e) {
          console.warn('Error formatting link:', e, url);
          // If not a valid URL, return first part of string with reasonable length
          return url.length > 20 ? url.substring(0, 18) + '...' : url;
        }
      },
      
      // Debug helper for links
      debugLinkInfo(subtask) {
        console.log('Subtask link info:', {
          id: subtask.id,
          name: subtask.name,
          hasLink: !!subtask.link,
          linkValue: subtask.link,
          linkType: typeof subtask.link,
          displayValue: this.formatLinkDisplay(subtask.link)
        });
        return !!subtask.link;
      },
      
      showNotification(text, color = 'primary', timeout = 3000) {
        this.snackbar = {
          show: true,
          text,
          color,
          timeout
        };
      }
    },
    mounted() {
      // Initialize socket connection first
      this.socket = io(window.location.origin);
      
      // Listen for socket connection and request data
      this.socket.on('connect', () => {
        console.log('Socket connected, requesting initial data');
        this.socket.emit('requestInitialData');
      });
      
      // Handle initial data and updates
      this.socket.on('initialData', (data) => {
        console.log('Received initial data:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
      });
      
      this.socket.on('updateTasks', (data) => {
        console.log('Received task update:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
      });
      
      // Listen for updates from task modules
      window.addEventListener('tasksUpdated', (event) => {
        if (event.detail && event.detail.tasks) {
          this.updateTasks(event.detail.tasks);
        }
      });
      
      // Share the Vue instance with modules
      window.taskManager = window.taskManager || {};
      window.taskManager.setVueApp?.(this);
      
      // Initialize chart after Vue is mounted
      setTimeout(() => {
        if (chartVisualization) {
          chartVisualization.initializeChart();
        }
      }, 100);
      
      // Apply dark theme if active
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
      }
      
      // Make app globally available
      window.app = this;
      
      // Dispatch event to signal that app is mounted
      window.dispatchEvent(new Event('app-mounted'));
    }
  });
  
  // Mount Vuetify to the app
  app.use(vuetify);
  
  // Mount the app to the DOM
  app.mount('#app');
  
  // Make app globally available
  window.app = app._instance.proxy;
});

// Now these exports will be valid since the variables are defined at the top level
export {
  chartVisualization,
  taskOperations,
  taskListManager
}; 