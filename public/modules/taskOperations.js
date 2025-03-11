export class TaskOperations {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.taskForm = document.querySelector('#task-form');
    this.selectedTaskId = null;
  }
  
  initializeForm() {
    if (this.taskForm) {
      this.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addTask();
      });
    }
  }
  
  addTask(taskData) {
    if (!taskData || !taskData.name) {
      console.error('Invalid task data:', taskData);
      return Promise.reject(new Error('Invalid task data'));
    }
    
    // Get socket from global io, window.app or taskManager
    const socket = window.app?.socket || 
                  (window.taskManager?.socket) || 
                  (typeof io !== 'undefined' ? io(window.location.origin) : null);
    
    if (!socket) {
      console.error('No socket connection available');
      return Promise.reject(new Error('No socket connection available'));
    }

    return new Promise((resolve, reject) => {
      // Set a one-time handler for task added response
      socket.once('taskAdded', (response) => {
        console.log('Task added response:', response);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to add task'));
        }
      });
      
      // Send the task to the server
      console.log('Sending task to server:', taskData);
      socket.emit('addTask', taskData);
      
      // Add timeout for the promise
      setTimeout(() => {
        socket.off('taskAdded'); // Remove the listener to prevent memory leaks
        reject(new Error('Timeout waiting for task added response'));
      }, 5000);
    });
  }

  toggleDone(taskId) {
    const socket = window.app?.socket || window.taskManager?.socket || io(window.location.origin);
    socket.emit('toggleDone', taskId);
    console.log('Sent toggleDone request for task:', taskId);
  }

  addSubtask(subtask, parentId) {
    console.log('TaskOperations.addSubtask called with:', subtask, 'parentId:', parentId);
    
    // Find parent task name safely
    let parentName = "Unknown Task";
    
    // Try to get tasks from window.app instead of this.taskManager
    if (window.app && Array.isArray(window.app.tasks)) {
      const parentTask = window.app.tasks.find(t => t.id === parentId);
      if (parentTask) {
        parentName = parentTask.name;
      }
    }
    
    // Get socket from window.app or create a new one
    const socket = window.app?.socket || 
                  (typeof io !== 'undefined' ? io(window.location.origin) : null);
    
    if (!socket) {
      console.error('No socket connection available');
      if (window.app?.showNotification) {
        window.app.showNotification('Connection error, try refreshing the page', 'error');
      }
      return;
    }
    
    // Send the request directly using the socket
    socket.emit('addSubtask', { subtask, parentId });
    console.log('Emitted addSubtask event to server');
    
    // Set a one-time listener for task updates
    socket.once('updateTasks', (response) => {
      console.log('Received response after adding subtask');
      
      // Show notification if possible
      if (window.app?.showNotification) {
        window.app.showNotification(`Added subtask "${subtask.name}" to "${parentName}"`, 'success');
      } else {
        console.log(`Added subtask "${subtask.name}" to "${parentName}"`);
      }
    });
  }

  updateSubtask(subtask) {
    console.log('TaskOperations.updateSubtask called with:', subtask);
    
    // Get socket safely
    const socket = window.app?.socket || 
                  (typeof io !== 'undefined' ? io(window.location.origin) : null);
    
    if (!socket) {
      console.error('No socket connection available');
      return;
    }
    
    // Find original subtask for comparison
    let originalSubtask = null;
    if (window.app?.tasks) {
      originalSubtask = window.app.tasks.find(t => t.id === subtask.id);
    }
    
    // Send the update
    socket.emit('updateSubtask', { subtask });
    
    // Handle response
    socket.once('updateTasks', () => {
      // Create message about what changed
      let message = "Updated subtask";
      if (originalSubtask) {
        const changes = [];
        if (originalSubtask.name !== subtask.name) changes.push("name");
        if (originalSubtask.importance !== subtask.importance) changes.push("importance");
        if (originalSubtask.urgency !== subtask.urgency) changes.push("urgency");
        if (originalSubtask.link !== subtask.link) changes.push("link");
        if (originalSubtask.due_date !== subtask.due_date) changes.push("due date");
        
        if (changes.length > 0) {
          message += ": " + changes.join(", ");
        }
      }
      
      // Show notification
      if (window.app?.showNotification) {
        window.app.showNotification(message, 'success');
      } else {
        console.log(message);
      }
    });
  }

  editTask(task) {
    console.log('TaskOperations.editTask called with:', task);
    
    // Get socket safely
    const socket = window.app?.socket || 
                  (typeof io !== 'undefined' ? io(window.location.origin) : null);
    
    if (!socket) {
      console.error('No socket connection available');
      if (window.app?.showNotification) {
        window.app.showNotification('Connection error, try refreshing the page', 'error');
      }
      return;
    }
    
    // Find original task for comparison
    let originalTask = null;
    if (window.app?.tasks) {
      originalTask = window.app.tasks.find(t => t.id === task.id);
    }
    
    // Send the edit request
    socket.emit('editTask', task);
    console.log('Emitted editTask event to server');
    
    // Handle response
    socket.once('updateTasks', () => {
      // Create message about what changed
      let message = "Updated task";
      if (originalTask) {
        const changes = [];
        if (originalTask.name !== task.name) changes.push("name");
        if (originalTask.importance !== task.importance) changes.push("importance");
        if (originalTask.urgency !== task.urgency) changes.push("urgency");
        if (originalTask.due_date !== task.due_date) changes.push("due date");
        if (originalTask.link !== task.link) changes.push("link");
        
        if (changes.length > 0) {
          message += ": " + changes.join(", ");
        }
      }
      
      // Show notification
      if (window.app?.showNotification) {
        window.app.showNotification(message, 'success');
      } else {
        console.log(message);
      }
    });
  }

  showNotification(message, type = 'default', icon = '📢') {
    // Use app's notification system if available
    if (window.app?.showNotification) {
      window.app.showNotification(message, type);
      return;
    }
    
    // Otherwise create a simple notification
    console.log(`${icon} ${message}`);
    
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 20px';
    notification.style.background = type === 'success' ? '#4CAF50' : 
                                   type === 'error' ? '#F44336' : '#2196F3';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }
} 