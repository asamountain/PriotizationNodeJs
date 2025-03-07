// Main entry point that coordinates between the modules
import { ChartVisualization } from './chartVisualization.js';
import { TaskOperations } from './taskOperations.js';
import { TaskListManager } from './taskListManager.js';

export class TaskManager {
  constructor() {
    try {
      // Initialize socket connection
      if (typeof io === 'undefined') {
        throw new Error('Socket.IO not loaded');
      }
      this.socket = io(window.location.origin);
      
      // Initialize tasks array
      this.tasks = [];
      
      // Theme handling
      this.isDarkTheme = document.body.classList.contains('dark-theme') || 
                          localStorage.getItem('isDarkTheme') === 'true';
      
      // Initialize modules
      this.chartModule = new ChartVisualization(this);
      this.operationsModule = new TaskOperations(this);
      this.listManager = new TaskListManager(this);
      
      // Socket initialization
      this.initializeSocket();
      
      // Add resize listener for responsive chart
      window.addEventListener('resize', this.handleResize.bind(this));
      
      // Make taskManager globally accessible for event handlers
      window.taskManager = this;
      
      // For Vue integration
      this.onTasksUpdate = null;
      this.vueApp = null;
    } catch (error) {
      console.error('TaskManager constructor error:', error);
    }
  }

  // Core socket handling
  initializeSocket() {
    this.socket.on('connect', () => {
      this.socket.emit('requestInitialData');
    });

    this.socket.on('initialData', (data) => {
      this.handleData(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('Server error:', error);
    });

    this.socket.on('taskAdded', (response) => {
      console.log('Task added:', response);
    });

    this.socket.on('updateTasks', (data) => {
      this.handleData(data);
    });
  }
  
  // Handle resize events
  handleResize() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.chartModule.initializeChart();
      if (this._lastData) {
        this.chartModule.renderChart(this._lastData);
      }
    }, 250);
  }
  
  // Central data handler
  handleData(data) {
    console.log('Received data from server:', data);
    
    const taskData = data && data.data ? data.data : data;
    
    if (taskData && Array.isArray(taskData)) {
      // Store data for resize events
      this._lastData = taskData;
      
      // Update the internal tasks array
      this.tasks = taskData;
      
      // Filter active and completed tasks
      const activeTasks = taskData.filter(task => !task.done && !task.parent_id);
      const completedTasks = taskData.filter(task => task.done && !task.parent_id);
      
      // Update modules
      this.chartModule.calculateQuadrantStats(activeTasks);
      this.chartModule.renderChart(taskData);
      this.listManager.updateTaskLists(activeTasks, completedTasks);
      
      // Vue integration
      if (this.vueApp) {
        try {
          if (typeof this.vueApp.$data !== 'undefined') {
            this.vueApp.tasks = taskData;
            this.vueApp.activeTasks = activeTasks;
            this.vueApp.completedTasks = completedTasks;
            
            if (this.chartModule.quadrantStats && this.vueApp.quadrantStats) {
              this.vueApp.quadrantStats = { ...this.chartModule.quadrantStats };
            }
          }
        } catch (error) {
          console.error('Error updating Vue data:', error);
        }
      }
      
      this.emitUpdate();
    } else {
      console.error('Invalid data received from server:', data);
    }
  }
  
  // Vue integration
  setVueApp(app) {
    this.vueApp = app;
    
    if (app) {
      const updateTheme = () => {
        this.isDarkTheme = app.isDarkTheme || document.body.classList.contains('dark-theme');
        this.chartModule.updateChartColors();
      };
      
      if (app.$watch) {
        app.$watch('isDarkTheme', updateTheme);
      } else {
        setTimeout(updateTheme, 100);
        window.addEventListener('themeChanged', updateTheme);
      }
    }
  }
  
  // Emit update event for Vue integration
  emitUpdate() {
    if (this.tasks) {
      const event = new CustomEvent('tasksUpdated', {
        detail: { tasks: this.tasks }
      });
      window.dispatchEvent(event);
    }
  }
  
  // Initialize all modules and request data
  init() {
    console.log('Initializing TaskManager');
    
    if (this.socket && this.socket.connected) {
      this.socket.emit('requestInitialData');
    } else if (this.socket) {
      this.socket.on('connect', () => {
        this.socket.emit('requestInitialData');
      });
    }
    
    this.chartModule.initializeChart();
    this.chartModule.initializeCompletionChart();
    this.operationsModule.initializeForm();
    this.listManager.initializeLists();
    
    this.emitUpdate();
    
    return this;
  }
  
  // Helpers to access functionality from submodules
  showNotification(message, type = 'default', icon = '📢') {
    return this.operationsModule.showNotification(message, type, icon);
  }
  
  focusOnTask(taskId) {
    this.chartModule.focusOnTask(taskId);
    this.listManager.focusOnTaskInList(taskId);
  }
} 