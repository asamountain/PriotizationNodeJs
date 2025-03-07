import { state, setVueApp } from './state.js';
import { initializeSocket, requestInitialData } from './socket.js';
import { ChartVisualization } from './chartVisualization.js';
import { TaskOperations } from './taskOperations.js';
import { TaskListManager } from './taskListManager.js';

// Initialize modules
const chartVisualization = new ChartVisualization();
const taskOperations = new TaskOperations();
const taskListManager = new TaskListManager();

// Set up global listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize socket
  initializeSocket();
  
  // Initialize charts
  chartVisualization.initializeChart();
  chartVisualization.initializeCompletionChart();
  
  // Initialize task lists
  taskListManager.initializeLists();
  
  // Request initial data
  requestInitialData();
  
  // Export for global access (for backwards compatibility)
  window.taskManager = {
    addTask: taskOperations.addTask.bind(taskOperations),
    toggleDone: taskOperations.toggleDone.bind(taskOperations),
    deleteTask: taskOperations.deleteTask.bind(taskOperations),
    addSubtask: taskOperations.addSubtask.bind(taskOperations),
    updateSubtask: taskOperations.updateSubtask.bind(taskOperations),
    showNotification: taskOperations.showNotification.bind(taskOperations),
    focusOnTask: chartVisualization.focusOnTask.bind(chartVisualization),
    setVueApp
  };
});

// Export for direct usage in JavaScript
export {
  chartVisualization,
  taskOperations,
  taskListManager,
  state,
  setVueApp
}; 