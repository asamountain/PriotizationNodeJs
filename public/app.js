import { TaskManager } from './taskManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize task manager
  const taskManager = new TaskManager();
  taskManager.init();

  // Initialize Vue application
  const app = window.Vue.createApp({
    data() {
      return {
        // Tasks data
        tasks: [],
        activeTasks: [],
        completedTasks: [],
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        taskLink: '',
        selectedTaskId: null,
        
        // UI state
        isDarkTheme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        showCompletedSubtasks: false,
        taskSectionOpen: {
          active: true,
          completed: true
        },
        
        // Stats data
        showStatsView: false,
        theme: 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        
        // Subtask modal
        showSubtaskModal: false,
        selectedParentId: null,
        newSubtask: {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: '',
          link: ''
        },
        
        // Edit modal
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          done: false,
          parent_id: null,
          originalParentId: null,
          link: ''
        },
        
        // New properties to fix errors
        showCompletedTasks: false,
        newTask: {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: null
        },
        
        // Computed properties for templates
        averageCompletionTime: '0 days',
        mostProductiveDay: 'None',
      };
    },
    computed: {
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      },
      hasCompletedTasks() {
        return this.completedTasks && this.completedTasks.length > 0;
      }
    },
    methods: {
      // Theme handling
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('darkTheme', this.isDarkTheme);
        document.querySelector('body').classList.toggle('dark-theme', this.isDarkTheme);
        taskManager.updateChartColors();
      },
      
      // Task submission
      submitTask() {
        if (!this.taskName.trim()) {
          taskManager.showNotification('Please enter a task name', 'warning');
          return;
        }
        
        // Clean up and validate the link if provided
        let link = '';
        if (this.taskLink && this.taskLink.trim()) {
          link = this.taskLink.trim();
          // Add http:// if missing
          if (!/^https?:\/\//i.test(link)) {
            link = 'http://' + link;
          }
        }
        
        const taskData = {
          name: this.taskName.trim(),
          importance: parseInt(this.taskImportance),
          urgency: parseInt(this.taskUrgency),
          link: link,
          parent_id: null
        };
        
        taskManager.addTask(taskData)
          .then(response => {
            if (response) {
              taskManager.showNotification('Task added successfully', 'success');
              this.taskName = '';
              this.taskImportance = 5;
              this.taskUrgency = 5;
              this.taskLink = ''; // Reset link field
            }
          })
          .catch(error => {
            taskManager.showNotification('Failed to add task', 'error');
            console.error('Error adding task:', error);
          });
      },
      
      // Task actions
      toggleTaskDone(task) {
        taskManager.toggleDone(task.id);
      },
      
      deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
          taskManager.deleteTask(taskId);
        }
      },
      
      handleTaskClick(taskId) {
        console.log('Handling task click:', taskId);
        taskManager.highlightTask(taskId);
      },
      
      // Subtask management
      getSubtasksForTask(taskId) {
        return this.tasks.filter(task => task.parent_id === taskId);
      },
      
      getCompletedSubtaskCount(taskId) {
        return this.getSubtasksForTask(taskId).filter(task => task.done).length;
      },
      
      showAddSubtaskForm(taskId) {
        this.selectedParentId = taskId;
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          due_date: '',
          link: ''
        };
        this.showSubtaskModal = true;
      },
      
      closeSubtaskModal() {
        this.showSubtaskModal = false;
        this.selectedTaskId = null;
      },
      
      addSubtask() {
        if (!this.newSubtask.name.trim()) {
          taskManager.showNotification('Please enter a subtask name', 'warning');
          return;
        }
        
        // Clean up and validate the link if provided
        let link = '';
        if (this.newSubtask.link && this.newSubtask.link.trim()) {
          link = this.newSubtask.link.trim();
          // Add http:// if missing
          if (!/^https?:\/\//i.test(link)) {
            link = 'http://' + link;
          }
        }
        
        const subtaskData = {
          name: this.newSubtask.name.trim(),
          importance: parseInt(this.newSubtask.importance),
          urgency: parseInt(this.newSubtask.urgency),
          parent_id: this.selectedParentId,
          due_date: this.newSubtask.due_date,
          link: link
        };
        
        taskManager.addSubtask(subtaskData, this.selectedParentId);
        this.closeSubtaskModal();
      },
      
      selectTask(task) {
        this.selectedTaskId = task.id;
        if (taskManager) {
          // Focus on this task in the chart
          taskManager.focusOnTask(task.id);
          
          // Also call handleTaskClick to focus the dot in the chart
          const event = { currentTarget: { dataset: { taskId: task.id } } };
          taskManager.handleTaskClick(event);
        }
      },
      
      // Edit task/subtask management
      editSubtask(subtask) {
        this.editingSubtask = {
          id: subtask.id,
          name: subtask.name,
          importance: subtask.importance,
          urgency: subtask.urgency,
          done: subtask.done,
          parent_id: subtask.parent_id,
          originalParentId: subtask.parent_id,
          link: subtask.link || ''
        };
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name.trim()) {
          taskManager.showNotification('Please enter a subtask name', 'warning');
          return;
        }
        
        // Clean up and validate the link if provided
        let link = '';
        if (this.editingSubtask.link && this.editingSubtask.link.trim()) {
          link = this.editingSubtask.link.trim();
          // Add http:// if missing
          if (!/^https?:\/\//i.test(link)) {
            link = 'http://' + link;
          }
        }
        
        const updatedSubtask = {
          id: this.editingSubtask.id,
          name: this.editingSubtask.name.trim(),
          importance: parseInt(this.editingSubtask.importance),
          urgency: parseInt(this.editingSubtask.urgency),
          done: this.editingSubtask.done,
          parent_id: this.editingSubtask.parent_id,
          link: link
        };
        
        taskManager.updateSubtask(updatedSubtask);
        this.showEditForm = false;
      },
      
      cancelEdit() {
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          done: false,
          parent_id: null,
          originalParentId: null,
          link: ''
        };
      },
      
      // UI helpers
      toggleShowCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
        localStorage.setItem('showCompletedSubtasks', this.showCompletedSubtasks);
      },
      
      toggleTaskSection(section) {
        this.taskSectionOpen[section] = !this.taskSectionOpen[section];
      },
      
      toggleCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
        
        // Toggle the 'hidden' class on completed subtasks
        document.querySelectorAll('.subtask.completed').forEach(el => {
          if (this.showCompletedSubtasks) {
            el.classList.remove('hidden');
          } else {
            el.classList.add('hidden');
          }
        });
      },
      
      updateTasks(tasks) {
        console.log('Vue app received tasks update:', tasks.length, 'tasks');
        this.tasks = tasks;
      },
      
      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
      },
      
      // Format link for display (shorten if too long)
      formatLinkDisplay(url) {
        if (!url) return '';
        
        try {
          const urlObj = new URL(url);
          // Extract hostname and pathname
          let display = urlObj.hostname;
          
          // Add short path if present (truncate if too long)
          if (urlObj.pathname && urlObj.pathname !== '/') {
            const path = urlObj.pathname;
            display += path.length > 15 ? path.substring(0, 12) + '...' : path;
          }
          
          return display;
        } catch (e) {
          // If URL parsing fails, just truncate the original
          return url.length > 30 ? url.substring(0, 27) + '...' : url;
        }
      },
      
      calculateQuadrantStats() {
        // Reset counters
        this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
        
        // Filter only parent tasks
        const parentTasks = this.tasks.filter(task => !task.parent_id);
        
        // Count tasks per quadrant
        parentTasks.forEach(task => {
          const quadrant = this.getQuadrantForTask(task);
          this.quadrantStats[quadrant]++;
        });
        
        // Calculate additional statistics (not implemented fully)
        this.calculateAdditionalStatistics();
      },
      
      getQuadrantForTask(task) {
        const highImportance = task.importance > 5;
        const highUrgency = task.urgency > 5;
        
        if (highImportance && highUrgency) return 'q1';
        if (highImportance && !highUrgency) return 'q2';
        if (!highImportance && highUrgency) return 'q3';
        return 'q4';
      },
      
      calculateAdditionalStatistics() {
        // These would be calculated from task data in a real implementation
        this.averageCompletionTime = '2.5 days';
        this.mostProductiveDay = 'Wednesday';
      },
      
      // Initialize drag and drop functionality
      initDragAndDrop() {
        this.$nextTick(() => {
          // Set up a mutation observer to watch for new tasks and subtasks
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.addedNodes.length) {
                this.setupDraggableElements();
              }
            });
          });
          
          // Observe the task table
          const taskTable = document.querySelector('.task-table');
          if (taskTable) {
            observer.observe(taskTable, { childList: true, subtree: true });
          }
          
          // Initial setup of draggable elements
          this.setupDraggableElements();
          
          // Setup the empty drop area
          this.setupEmptyDropArea();
        });
      },
      
      // Set up the empty drop area for converting subtasks to main tasks
      setupEmptyDropArea() {
        const emptyArea = document.querySelector('#empty-drop-area');
        if (!emptyArea) return;
        
        emptyArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          emptyArea.classList.add('drag-over');
        });
        
        emptyArea.addEventListener('dragleave', (e) => {
          emptyArea.classList.remove('drag-over');
        });
        
        emptyArea.addEventListener('drop', (e) => {
          e.preventDefault();
          emptyArea.classList.remove('drag-over');
          
          // Get the dragged element info
          const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
          const draggedType = e.dataTransfer.getData('type');
          
          // Only handle subtask drops
          if (draggedType === 'subtask') {
            this.makeSubtaskATask(draggedId);
          }
        });
      },
      
      // Set up draggable elements
      setupDraggableElements() {
        // Make all tasks draggable
        document.querySelectorAll('.task').forEach(task => {
          this.setupDraggable(task, 'task');
        });
        
        // Make all subtasks draggable
        document.querySelectorAll('.subtask').forEach(subtask => {
          this.setupDraggable(subtask, 'subtask');
        });
      },
      
      // Setup draggable element
      setupDraggable(element, type) {
        // Skip if already setup
        if (element.getAttribute('draggable') === 'true') return;
        
        // Make element draggable
        element.setAttribute('draggable', 'true');
        
        // Add event listeners
        element.addEventListener('dragstart', (e) => this.handleDragStart(e, type));
        element.addEventListener('dragend', (e) => this.handleDragEnd(e, type));
        element.addEventListener('dragover', (e) => this.handleDragOver(e, type));
        element.addEventListener('dragleave', (e) => this.handleDragLeave(e, type));
        element.addEventListener('drop', (e) => this.handleDrop(e, type));
      },
      
      // Handle drag start
      handleDragStart(e, type) {
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-task-id') || e.target.getAttribute('data-subtask-id'));
        e.dataTransfer.setData('type', type);
        e.target.classList.add('dragging');
      },
      
      // Handle drag end
      handleDragEnd(e, type) {
        e.target.classList.remove('dragging');
        // Remove drag-over class from all elements
        document.querySelectorAll('.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
      },
      
      // Handle drag over
      handleDragOver(e, type) {
        e.preventDefault();
        e.target.closest('.task, .subtask').classList.add('drag-over');
      },
      
      // Handle drag leave
      handleDragLeave(e, type) {
        e.target.closest('.task, .subtask').classList.remove('drag-over');
      },
      
      // Handle drop
      handleDrop(e, type) {
        e.preventDefault();
        
        // Get dragged element info
        const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
        const draggedType = e.dataTransfer.getData('type');
        
        // Get drop target info
        const dropTarget = e.target.closest('.task, .subtask');
        const dropTargetId = parseInt(dropTarget.getAttribute('data-task-id') || dropTarget.getAttribute('data-subtask-id'));
        
        // Remove drag-over class
        dropTarget.classList.remove('drag-over');
        
        // Handle different drop scenarios
        if (draggedType === 'task' && type === 'task') {
          // Task dropped on task - do nothing for now
          console.log('Task dropped on task', draggedId, dropTargetId);
        } 
        else if (draggedType === 'task' && type === 'subtask') {
          // Task dropped on subtask - make task a subtask of the parent of the target subtask
          this.makeTaskASubtask(draggedId, this.getParentId(dropTargetId));
        } 
        else if (draggedType === 'subtask' && type === 'task') {
          // Subtask dropped on task - move subtask to new parent
          this.moveSubtaskToNewParent(draggedId, dropTargetId);
        } 
        else if (draggedType === 'subtask' && type === 'subtask') {
          // Subtask dropped on subtask - move to same parent
          this.moveSubtaskToNewParent(draggedId, this.getParentId(dropTargetId));
        }
      },
      
      // Get parent ID of a subtask
      getParentId(subtaskId) {
        const subtask = this.tasks.find(t => t.id === subtaskId);
        return subtask ? subtask.parent_id : null;
      },
      
      // Make a task into a subtask
      makeTaskASubtask(taskId, parentId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.parent_id || task.id === parentId) return;
        
        // Create new subtask data
        const subtaskData = {
          id: task.id,
          name: task.name,
          importance: task.importance,
          urgency: task.urgency,
          done: task.done,
          parent_id: parentId
        };
        
        // Update task to be a subtask
        taskManager.updateSubtask(subtaskData);
      },
      
      // Move subtask to a new parent
      moveSubtaskToNewParent(subtaskId, newParentId) {
        const subtask = this.tasks.find(t => t.id === subtaskId);
        if (!subtask || subtask.id === newParentId) return;
        
        // Update subtask with new parent
        subtask.parent_id = newParentId;
        taskManager.updateSubtask(subtask);
      },
      
      // Make a subtask into a main task
      makeSubtaskATask(subtaskId) {
        const subtask = this.tasks.find(t => t.id === subtaskId);
        if (!subtask || !subtask.parent_id) return;
        
        // Update subtask to remove parent
        subtask.parent_id = null;
        taskManager.updateSubtask(subtask);
      },
      
      // Refresh task lists
      refreshTaskLists() {
        // Filter active and completed tasks
        this.activeTasks = this.tasks.filter(task => !task.done && !task.parent_id);
        this.completedTasks = this.tasks.filter(task => task.done && !task.parent_id);
        
        // Calculate quadrant statistics
        this.calculateQuadrantStats();
      },
    },
    mounted() {
      // Get saved theme preference
      const savedTheme = localStorage.getItem('isDarkTheme');
      if (savedTheme !== null) {
        this.isDarkTheme = savedTheme === 'true';
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
        } else {
          document.body.classList.remove('dark-theme');
        }
      }

      // Set the taskManager reference for Vue integration
      taskManager.setVueApp(this);
      taskManager.onTasksUpdate = this.updateTasks.bind(this);
      
      // Listen for task updates from the TaskManager
      window.addEventListener('tasksUpdated', (event) => {
        if (event.detail && event.detail.tasks) {
          this.tasks = event.detail.tasks;
          this.refreshTaskLists();
        }
      });
      
      // Initialize drag and drop functionality
      this.initDragAndDrop();
    }
  });
  
  // Mount Vue app
  app.mount('#app');
}); 