import { state, on, emit } from './state.js';

export class TaskListManager {
  constructor() {
    this.taskList = document.querySelector('#task-list');
    
    // Listen for task updates
    on('tasksUpdated', this.handleTasksUpdated.bind(this));
    on('taskFocused', this.focusOnTaskInList.bind(this));
  }
  
  handleTasksUpdated(tasks) {
    const activeTasks = tasks.filter(task => !task.done && !task.parent_id);
    const completedTasks = tasks.filter(task => task.done && !task.parent_id);
    this.updateTaskLists(activeTasks, completedTasks);
  }
  
  initializeLists() {
    // Initial setup of task lists
    if (state.tasks && state.tasks.length > 0) {
      const activeTasks = state.tasks.filter(task => !task.done && !task.parent_id);
      const completedTasks = state.tasks.filter(task => task.done && !task.parent_id);
      this.updateTaskLists(activeTasks, completedTasks);
    }
  }
  
  updateTaskLists(activeTasks, completedTasks) {
    // Update the active task list
    this.renderActiveTaskList(activeTasks);
    
    // Update the completed task list
    this.renderCompletedTaskList(completedTasks);
  }
  
  renderActiveTaskList(activeTasks) {
    if (!this.taskList) return;
    
    // Clear existing tasks
    this.taskList.innerHTML = '';
    
    // Render active tasks
    activeTasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      this.taskList.appendChild(taskElement);
      
      // Render subtasks if any
      const subtasks = state.tasks.filter(t => t.parent_id === task.id);
      if (subtasks.length > 0) {
        const subtasksContainer = document.createElement('div');
        subtasksContainer.classList.add('subtasks-container');
        
        subtasks.forEach(subtask => {
          const subtaskElement = this.createTaskElement(subtask, true);
          subtasksContainer.appendChild(subtaskElement);
        });
        
        taskElement.appendChild(subtasksContainer);
      }
    });
  }
  
  renderCompletedTaskList(completedTasks) {
    const completedList = document.querySelector('#completed-task-list');
    if (!completedList) return;
    
    // Clear existing completed tasks
    completedList.innerHTML = '';
    
    // Render completed tasks
    completedTasks.forEach(task => {
      const taskElement = this.createTaskElement(task, false, true);
      completedList.appendChild(taskElement);
    });
  }
  
  createTaskElement(task, isSubtask = false, isCompleted = false) {
    // Create task element (implementation details...)
    const taskElement = document.createElement('div');
    taskElement.className = `task${isSubtask ? ' subtask' : ''}${isCompleted ? ' completed' : ''}`;
    taskElement.setAttribute('data-task-id', task.id);
    
    // Add task content
    taskElement.innerHTML = `
      <div class="task-header">
        <div class="task-checkbox">
          <input type="checkbox" ${task.done ? 'checked' : ''}>
        </div>
        <div class="task-title">${task.name}</div>
        <div class="task-actions">
          <button class="task-action edit-task">✏️</button>
          <button class="task-action delete-task">🗑️</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const checkbox = taskElement.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        emit('toggleTaskDone', task.id);
      });
    }
    
    taskElement.addEventListener('click', (e) => {
      if (!e.target.closest('button, input')) {
        emit('taskSelected', task);
      }
    });
    
    const editButton = taskElement.querySelector('.edit-task');
    if (editButton) {
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        emit('editTask', task);
      });
    }
    
    const deleteButton = taskElement.querySelector('.delete-task');
    if (deleteButton) {
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        emit('deleteTask', task.id);
      });
    }
    
    return taskElement;
  }
  
  focusOnTaskInList({ taskId }) {
    // Find the task element in the list
    let taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
    
    if (taskElement) {
      // Remove highlight from all tasks
      document.querySelectorAll('.task.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Add highlight to this task
      taskElement.classList.add('selected');
      
      // Scroll to the task
      taskElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
      
      // Add a brief highlight animation
      taskElement.classList.add('highlight-pulse');
      setTimeout(() => {
        taskElement.classList.remove('highlight-pulse');
      }, 1500);
    }
  }
} 