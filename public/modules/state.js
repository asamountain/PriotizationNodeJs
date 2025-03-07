// Shared state accessible to all modules
export const state = {
  tasks: [],
  isDarkTheme: document.body.classList.contains('dark-theme') || 
              localStorage.getItem('isDarkTheme') === 'true',
  vueApp: null,
  selectedTaskId: null
};

// Event system for cross-module communication
const eventListeners = {};

export function on(event, callback) {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
}

export function emit(event, data) {
  if (eventListeners[event]) {
    eventListeners[event].forEach(callback => callback(data));
  }
  
  // Also dispatch DOM event for external listeners
  const domEvent = new CustomEvent(event, { detail: data });
  window.dispatchEvent(domEvent);
}

// Handle theme changes
export function updateTheme(isDark) {
  state.isDarkTheme = isDark;
  emit('themeChanged', isDark);
}

// Set Vue app reference
export function setVueApp(app) {
  state.vueApp = app;
  
  if (app) {
    const updateTheme = () => {
      state.isDarkTheme = app.isDarkTheme || document.body.classList.contains('dark-theme');
      emit('themeChanged', state.isDarkTheme);
    };
    
    if (app.$watch) {
      app.$watch('isDarkTheme', updateTheme);
    } else {
      setTimeout(updateTheme, 100);
      window.addEventListener('themeChanged', updateTheme);
    }
  }
}

// Update Vue app with latest data
export function updateVueApp() {
  if (state.vueApp && typeof state.vueApp.$data !== 'undefined') {
    try {
      state.vueApp.tasks = state.tasks;
      state.vueApp.activeTasks = state.tasks.filter(task => !task.done && !task.parent_id);
      state.vueApp.completedTasks = state.tasks.filter(task => task.done && !task.parent_id);
      
      // Quadrant stats will be updated by chart module
    } catch (error) {
      console.error('Error updating Vue data:', error);
    }
  }
} 