/**
 * Task Service - Handles all API calls to the tasks endpoints
 */
const API_URL = '/api';

export const TaskService = {
  // Get all tasks for a user
  async getTasks(userId) {
    const response = await fetch(`${API_URL}/tasks?userId=${userId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch tasks');
    }
    
    return data.data;
  },
  
  // Get a single task
  async getTask(id) {
    const response = await fetch(`${API_URL}/tasks/${id}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch task');
    }
    
    return data.data;
  },
  
  // Create a new task
  async createTask(task) {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create task');
    }
    
    return data.data;
  },
  
  // Update a task
  async updateTask(id, updates) {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update task');
    }
    
    return data.data;
  },
  
  // Delete a task
  async deleteTask(id) {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete task');
    }
    
    return true;
  },
  
  // Toggle task completion status
  async toggleTaskCompletion(id, completed) {
    return this.updateTask(id, { 
      completed,
      completedAt: completed ? new Date().toISOString() : null
    });
  }
};

export default TaskService; 