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
    
    // Find parent task name for better notification
    let parentName = "Unknown";
    if (this.taskManager.tasks && Array.isArray(this.taskManager.tasks)) {
      const parentTask = this.taskManager.tasks.find(t => t.id === parentId);
      if (parentTask) {
        parentName = parentTask.name;
      }
    }
    
    // Define one-time handler for subtask added response
    const onSubtaskAdded = (response) => {
      console.log('Subtask added response:', response);
      if (response && response.success) {
        this.showNotification(`Added subtask "${subtask.name}" to "${parentName}"`, 'success', '✅');
      }
      // Remove the listener to avoid accumulating handlers
      this.taskManager.socket.off('updateTasks', onSubtaskAdded);
    };
    
    // Listen for response
    this.taskManager.socket.once('updateTasks', onSubtaskAdded);
    
    // Send the request
    this.taskManager.socket.emit('addSubtask', { subtask, parentId });
  }

  updateSubtask(subtask) {
    console.log('TaskOperations.updateSubtask called with:', subtask);
    
    // Store original subtask data for comparison if available
    let originalSubtask = null;
    if (this.taskManager.tasks && Array.isArray(this.taskManager.tasks)) {
      originalSubtask = this.taskManager.tasks.find(t => t.id === subtask.id);
    }
    
    // Define one-time handler for subtask updated response
    const onSubtaskUpdated = (response) => {
      console.log('Subtask updated response:', response);
      if (response) {
        // Determine what was changed for a more informative notification
        let changeDescription = "Updated subtask";
        
        if (originalSubtask) {
          const changes = [];
          if (originalSubtask.name !== subtask.name) {
            changes.push("name");
          }
          if (originalSubtask.importance !== subtask.importance || 
              originalSubtask.urgency !== subtask.urgency) {
            changes.push("priority");
          }
          if (originalSubtask.parent_id !== subtask.parent_id) {
            changes.push("parent task");
          }
          
          if (changes.length > 0) {
            changeDescription += ": " + changes.join(", ");
          }
          
          this.showNotification(changeDescription, 'success', '✅');
        }
      }
      // Remove the listener to avoid accumulating handlers
      this.taskManager.socket.off('updateTasks', onSubtaskUpdated);
    };
    
    // Listen for response
    this.taskManager.socket.once('updateTasks', onSubtaskUpdated);
    
    // Send the request
    this.taskManager.socket.emit('updateSubtask', subtask);
  }

  showNotification(message, type = 'default', icon = '📢') {
    // Implementation of showNotification method
  }
} 