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
    
    // Ensure link is properly formatted
    if (subtask.link && typeof subtask.link === 'string') {
      // Add http:// prefix if missing
      if (!/^https?:\/\//i.test(subtask.link)) {
        subtask.link = 'http://' + subtask.link;
        console.log('Added http:// prefix to link:', subtask.link);
      }
    }
    
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
    
    // Ensure link is properly formatted
    if (subtask.link && typeof subtask.link === 'string') {
      // Add http:// prefix if missing
      if (!/^https?:\/\//i.test(subtask.link)) {
        subtask.link = 'http://' + subtask.link;
        console.log('Added http:// prefix to link:', subtask.link);
      }
    }
    
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
    
    // Log link state before sending
    console.log('Link state before update:', {
      subtaskId: subtask.id,
      originalLink: originalSubtask?.link,
      newLink: subtask.link
    });
    
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
        if (originalSubtask.link !== subtask.link) {
          changes.push("link");
          // Special notification for link changes
          if (!originalSubtask.link && subtask.link) {
            message = `Added link to subtask "${subtask.name}"`;
          } else if (originalSubtask.link && !subtask.link) {
            message = `Removed link from subtask "${subtask.name}"`;
          } else if (originalSubtask.link && subtask.link && originalSubtask.link !== subtask.link) {
            message = `Updated link for subtask "${subtask.name}"`;
          }
        }
        if (originalSubtask.due_date !== subtask.due_date) changes.push("due date");
        
        if (changes.length > 0 && message === "Updated subtask") {
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
    
    // Ensure link is properly formatted
    if (task.link && typeof task.link === 'string') {
      // Add http:// prefix if missing
      if (!/^https?:\/\//i.test(task.link)) {
        task.link = 'http://' + task.link;
        console.log('Added http:// prefix to link:', task.link);
      }
    }
    
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
    
    // Log link state before sending
    console.log('Link state before update:', {
      taskId: task.id,
      originalLink: originalTask?.link,
      newLink: task.link
    });
    
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
        if (originalTask.link !== task.link) {
          changes.push("link");
          // Special notification for link changes
          if (!originalTask.link && task.link) {
            message = `Added link to task "${task.name}"`;
          } else if (originalTask.link && !task.link) {
            message = `Removed link from task "${task.name}"`;
          } else if (originalTask.link && task.link && originalTask.link !== task.link) {
            message = `Updated link for task "${task.name}"`;
          }
        }
        
        if (changes.length > 0 && message === "Updated task") {
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

  updateTaskNotes(taskId, notes) {
    console.log('TaskOperations.updateTaskNotes called for task:', taskId);
    console.log('Notes content to save:', notes);
    
    // Get socket safely
    const socket = window.app?.socket || 
                  (typeof io !== 'undefined' ? io(window.location.origin) : null);
    
    if (!socket) {
      console.error('No socket connection available');
      return;
    }
    
    // First check if the task exists and has current notes
    socket.emit('getTaskDetails', { taskId });
    socket.once('taskDetails', (taskData) => {
      console.log('Current task data before update:', taskData);
      console.log('Current notes value:', taskData?.notes);
      
      // Now save the new notes
      socket.emit('updateTaskNotes', { taskId, notes });
      
      // Verify notes were saved
      socket.once('updateTasks', () => {
        console.log('Notes update completed');
        
        // Double-check the notes were saved correctly
        setTimeout(() => {
          socket.emit('getTaskDetails', { taskId });
          socket.once('taskDetails', (updatedTask) => {
            console.log('Task data after update:', updatedTask);
            console.log('New notes value:', updatedTask?.notes);
            
            if (updatedTask?.notes !== notes) {
              console.error('Notes mismatch! Expected:', notes, 'Got:', updatedTask?.notes);
            } else {
              console.log('Notes verified successfully');
            }
          });
        }, 500);
      });
    });
  }
} 