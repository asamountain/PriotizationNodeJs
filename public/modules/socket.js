import { state, emit, updateVueApp } from './state.js';

let socket = null;

export function initializeSocket() {
  if (typeof io === 'undefined') {
    console.error('Socket.IO not loaded');
    return null;
  }
  
  socket = io(window.location.origin);
  
  socket.on('connect', () => {
    requestInitialData();
  });
  
  socket.on('initialData', handleData);
  socket.on('updateTasks', handleData);
  socket.on('taskAdded', (response) => {
    console.log('Task added:', response);
    emit('taskAdded', response);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  socket.on('error', (error) => {
    console.error('Server error:', error);
  });
  
  return socket;
}

export function getSocket() {
  return socket;
}

export function requestInitialData() {
  if (socket && socket.connected) {
    socket.emit('requestInitialData');
  } else {
    console.warn('Socket not connected, cannot request data');
  }
}

function handleData(data) {
  const taskData = data && data.data ? data.data : data;
  
  if (taskData && Array.isArray(taskData)) {
    // Update the shared state
    state.tasks = taskData;
    
    // Emit event for all modules to update
    emit('tasksUpdated', taskData);
    
    // Update Vue app
    updateVueApp();
  } else {
    console.error('Invalid data received from server:', data);
  }
}

// Socket operation methods
export function addTask(taskData) {
  if (!socket) return Promise.reject(new Error('Socket not initialized'));
  
  return new Promise((resolve, reject) => {
    const onTaskAdded = (response) => {
      socket.off('taskAdded', onTaskAdded);
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error('Failed to add task'));
      }
    };
    
    socket.on('taskAdded', onTaskAdded);
    socket.emit('addTask', taskData);
  });
}

export function toggleDone(taskId) {
  if (!socket) return;
  socket.emit('toggleDone', taskId);
}

export function deleteTask(taskId) {
  if (!socket) return;
  socket.emit('deleteTask', taskId);
}

export function addSubtask(subtask, parentId) {
  if (!socket) return;
  socket.emit('addSubtask', { subtask, parentId });
}

export function updateSubtask(subtask) {
  if (!socket) return;
  socket.emit('updateSubtask', { subtask });
} 