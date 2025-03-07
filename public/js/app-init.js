// Initialize application and track events
window.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - Vuetify version:', typeof Vuetify);
  
  // Add listener to track app initialization
  window.addEventListener('app-initialized', function(e) {
    console.log('App initialized with tasks:', e.detail.taskCount);
  });
  
  // Debug socket events
  document.addEventListener('socket-event', function(e) {
    console.log('Socket event:', e.detail.event, 'with data:', e.detail.data);
  });
});

// Monitor app mounting for Vue 3
window.addEventListener('app-mounted', function() {
  // Wait for app to be available in the window object
  if (window.app && typeof window.app.updateTasks === 'function') {
    const originalUpdateTasks = window.app.updateTasks;
    
    window.app.updateTasks = function(tasks) {
      console.log('updateTasks called with:', tasks?.length || 0, 'tasks');
      
      // Dispatch custom event
      const event = new CustomEvent('app-initialized', {
        detail: { taskCount: tasks?.length || 0 }
      });
      window.dispatchEvent(event);
      
      // Call original method
      return originalUpdateTasks.call(this, tasks);
    };
  }
}); 