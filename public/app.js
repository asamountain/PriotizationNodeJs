import { TaskManager } from './taskManager.js';
import { ChartVisualization } from './modules/chartVisualization.js';
import { TaskOperations } from './modules/taskOperations.js';
import { TaskListManager } from './modules/taskListManager.js';

// Define these variables at the top level so they can be exported
let chartVisualization = null;
let taskOperations = null;
let taskListManager = null;

// Wait for DOM and resources to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app');
  
  // Make sure Vuetify is properly loaded
  if (typeof Vuetify === 'undefined') {
    console.error('Vuetify not loaded! Check your script imports.');
    document.body.innerHTML = '<div style="color:red;padding:20px;">Error: Vuetify library not loaded. Please check your internet connection and reload the page.</div>';
    return;
  }
  
  // Create Vuetify instance
  const vuetify = Vuetify.createVuetify({
    theme: {
      defaultTheme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
      themes: {
        light: {
          colors: {
            primary: '#1976D2',
            secondary: '#9C27B0',
            accent: '#FF4081',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
            success: '#4CAF50',
          },
        },
        dark: {
          colors: {
            primary: '#2196F3',
            secondary: '#BB86FC',
            accent: '#03DAC6',
            error: '#CF6679',
            warning: '#FFB74D',
            info: '#64B5F6',
            success: '#81C784',
          },
        },
      },
    },
  });
  
  // Initialize modules - assign to the global variables we defined earlier
  chartVisualization = new ChartVisualization();
  taskOperations = new TaskOperations();
  taskListManager = new TaskListManager();
  
  // Create Vue app with Vuetify
  const app = Vue.createApp({
    data() {
      return {
        tasks: [],
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        taskLink: '',
        taskDueDate: null,
        isDarkTheme: localStorage.getItem('isDarkTheme') === 'true',
        theme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        newSubtask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        },
        showSubtaskModal: false,
        parentId: null,
        showCompletedSubtasks: false,
        taskSectionOpen: {
          active: true,
          completed: false
        },
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        },
        possibleParents: [],
        snackbar: {
          show: false,
          text: '',
          color: 'primary',
          timeout: 3000
        },
        socket: null,
        showNotesDialog: false,
        editingNotes: '',
        currentTask: null,
        noteTaskId: null,
        newTaskName: '',
        newTaskImportance: 5,
        newTaskUrgency: 5,
        newTaskDueDate: null,
        newTaskNotes: '',
        selectedParentId: null,
      };
    },
    computed: {
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      },
      hasCompletedTasks() {
        return this.completedTasks && this.completedTasks.length > 0;
      },
      hierarchicalTasks() {
        return this.buildTaskHierarchy(this.tasks);
      },
      activeTasks() {
        const tasks = this.tasks.filter(task => {
          // Debug checking each task
          console.log('Checking task for active status:', task.id, task.name, 'done:', task.done);
          
          // MongoDB field is "completed" but we transform it to "done" in handleInitialData
          // Just be extra explicit about what we're checking
          return task.done === false && !task.parent_id;
        });
        console.log('Active tasks count:', tasks.length);
        console.warn('IMPORTANT: Active tasks array:', JSON.stringify(tasks.map(t => ({id: t.id, name: t.name}))));
        return tasks;
      },
      completedTasks() {
        return this.tasks.filter(task => task.done && !task.parent_id);
      },
    },
    methods: {
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.theme = this.isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('isDarkTheme', this.isDarkTheme);
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Update chart colors
        if (chartVisualization && typeof chartVisualization.updateChartColors === 'function') {
          chartVisualization.updateChartColors();
        }
      },
      
      // New method to force refresh the task list
      refreshTaskList() {
        console.log('Forcing task list refresh');
        // Create a temporary copy 
        const tempTasks = [...this.tasks];
        // Clear and then restore the tasks to force Vue to refresh the computed properties
        this.tasks = [];
        setTimeout(() => {
          this.tasks = tempTasks;
          console.log('Tasks refreshed, active count:', this.activeTasks.length);
        }, 10);
      },
      
      submitTask() {
        if (!this.taskName) return;
        
        const taskData = {
          name: this.taskName,
          importance: this.taskImportance,
          urgency: this.taskUrgency,
          link: this.taskLink || null,
          due_date: this.taskDueDate || null
        };
        
        taskOperations.addTask(taskData);
        
        // Reset form
              this.taskName = '';
              this.taskImportance = 5;
              this.taskUrgency = 5;
        this.taskLink = '';
        this.taskDueDate = null;
      },
      
      toggleTaskDone(task) {
        taskOperations.toggleDone(task.id);
      },
      
      deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
          taskOperations.deleteTask(taskId);
        }
      },
      
      getSubtasksForTask(taskId) {
        const subtasks = this.tasks.filter(task => task.parent_id === taskId);
        
        // Debug logging for subtasks with links
        subtasks.forEach(subtask => {
          if (subtask.link) {
            console.log(`UI: Displaying subtask ${subtask.id} with link: ${subtask.link}`);
          }
        });
        
        return subtasks;
      },
      
      showAddSubtaskForm(taskId) {
        this.parentId = taskId;
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
        this.showSubtaskModal = true;
      },
      
      closeSubtaskModal() {
        this.showSubtaskModal = false;
        this.parentId = null;
      },
      
      addSubtask() {
        if (!this.newSubtask.name || !this.parentId) return;
        
        taskOperations.addSubtask(this.newSubtask, this.parentId);
        
        this.showSubtaskModal = false;
        this.parentId = null;
        
        // Reset the newSubtask object
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      selectTask(task) {
        if (chartVisualization) {
          chartVisualization.focusOnTask(task.id);
        }
      },
      
      editSubtask(subtask) {
        this.editingSubtask = { ...subtask };
        this.possibleParents = this.activeTasks;
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name) return;
        
        console.log("UI: Saving subtask edit:");
        console.log("UI: Subtask ID:", this.editingSubtask.id);
        console.log("UI: Subtask link before saving:", this.editingSubtask.link);
        
        // Ensure link is properly formatted
        if (this.editingSubtask.link && typeof this.editingSubtask.link === 'string') {
          // Add http:// prefix if missing
          if (!/^https?:\/\//i.test(this.editingSubtask.link)) {
            this.editingSubtask.link = 'http://' + this.editingSubtask.link;
            console.log("UI: Added http:// prefix to link:", this.editingSubtask.link);
          }
        }
        
        console.log("UI: Final subtask link value being sent:", this.editingSubtask.link);
        taskOperations.updateSubtask(this.editingSubtask);
        
        this.showNotification("Saving subtask with link: " + (this.editingSubtask.link || "none"), "info");
        
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null
        };
      },
      
      cancelEdit() {
        this.showEditForm = false;
      },
      
      editTask(task) {
        this.editingTask = { ...task };
        this.showTaskEditForm = true;
      },
      
      saveTaskEdit() {
        if (!this.editingTask.name) return;
        
        taskOperations.editTask(this.editingTask);
        
        this.showTaskEditForm = false;
        this.editingTask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      cancelTaskEdit() {
        this.showTaskEditForm = false;
      },
      
      toggleTaskSection(section) {
        this.taskSectionOpen[section] = !this.taskSectionOpen[section];
      },
      
      toggleCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
      },
      
      updateTasks(tasks) {
        this.tasks = tasks;
        
        // Debug: Log information about tasks with links
        console.log('Tasks with links:');
        tasks.forEach(task => {
          if (task.link) {
            console.log(`Task ${task.id} (${task.name}): ${task.link}`);
          }
        });
        
        // Debug: Count of subtasks with links
        const subtasks = tasks.filter(task => task.parent_id);
        const subtasksWithLinks = subtasks.filter(task => task.link);
        console.log(`Subtasks with links: ${subtasksWithLinks.length} out of ${subtasks.length}`);
        if (subtasksWithLinks.length > 0) {
          console.log('Subtasks with links:', subtasksWithLinks);
        }
      },
      
      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      },
      
      formatLinkDisplay(url) {
        if (!url) return 'No link';
        try {
          console.log('Formatting link:', url); // Debug logging
          const urlObj = new URL(url);
          // Show domain and first part of path if exists
          let displayText = urlObj.hostname;
          if (urlObj.pathname && urlObj.pathname !== '/') {
            // Add first part of path if not too long
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
              const firstPart = pathParts[0];
              if (firstPart.length < 10) {
                displayText += '/' + firstPart;
                if (pathParts.length > 1) {
                  displayText += '/...';
                }
              }
            }
          }
          return displayText || url;
        } catch (e) {
          console.warn('Error formatting link:', e, url);
          // If not a valid URL, return first part of string with reasonable length
          return url.length > 20 ? url.substring(0, 18) + '...' : url;
        }
      },
      
      // Debug helper for links
      debugLinkInfo(subtask) {
        console.log('Subtask link info:', {
          id: subtask.id,
          name: subtask.name,
          hasLink: !!subtask.link,
          linkValue: subtask.link,
          linkType: typeof subtask.link,
          displayValue: this.formatLinkDisplay(subtask.link)
        });
        return !!subtask.link;
      },
      
      showNotification(text, color = 'primary', timeout = 3000) {
        this.snackbar = {
          show: true,
          text,
          color,
          timeout
        };
      },
      
      editTaskNotes(task) {
        console.log("Opening notes for task:", task.id, task.name);
        
        // Force fetch the latest task data from the server to ensure we have latest notes
        const socket = this.socket || window.socket;
        if (socket) {
          socket.emit('getTaskDetails', { taskId: task.id });
          
          // Set up a one-time listener for the response
          socket.once('taskDetails', (taskData) => {
            console.log("Received task details:", taskData);
            if (taskData && taskData.id === task.id) {
              this.currentTask = taskData;
              this.editingNotes = taskData.notes || '';
              this.noteTaskId = task.id;
              
              console.log("Setting notes to:", this.editingNotes);
              this.showNotesDialog = true;
            }
          });
        } else {
          // Fallback to using local data if socket isn't available
          const latestTask = this.tasks.find(t => t.id === task.id);
          if (latestTask) {
            console.log("Using local task data:", latestTask);
            this.currentTask = { ...latestTask };
            this.editingNotes = latestTask.notes || '';
            this.noteTaskId = task.id;
            
            console.log("Setting notes to:", this.editingNotes);
            this.showNotesDialog = true;
          } else {
            console.error("Task not found in local data");
          }
        }
      },
      
      editSubtaskNotes(subtask) {
        this.currentTask = subtask;
        this.editingNotes = subtask.notes || '';
        this.showNotesDialog = true;
      },
      
      showTaskNotes(task) {
        this.currentTask = task;
        this.editingNotes = task.notes || '';
        this.showNotesDialog = true;
      },
      
      closeNotesDialog() {
        console.log("Closing notes dialog");
        this.showNotesDialog = false;
        this.currentTask = null;
        this.editingNotes = '';
        this.noteTaskId = null;
      },
      
      showAddTaskDialog() {
        // Reset form fields
        this.newTaskName = '';
        this.newTaskImportance = 5;
        this.newTaskUrgency = 5;
        this.newTaskDueDate = null;
        this.newTaskNotes = '';
        this.selectedParentId = null;
        
        // Show dialog - activate the appropriate UI component
        document.querySelector('#task-form-card').scrollIntoView({ behavior: 'smooth' });
      },
      
      saveTaskNotes() {
        console.log("Saving notes for task:", this.currentTask?.id);
        if (!this.currentTask) {
          console.error("No current task selected");
          return;
        }
        
        console.log("Notes content:", this.editingNotes);
        
        // Store notes in database through socket
        taskOperations.updateTaskNotes(this.currentTask.id, this.editingNotes);
        
        // Update notes in local data using Vue 3 reactivity - fixed
        const taskIndex = this.tasks.findIndex(t => t.id === this.currentTask.id);
        if (taskIndex >= 0) {
          console.log("Updating local task data with new notes");
          // Vue 3 way - directly modify the array
          this.tasks[taskIndex] = { 
            ...this.tasks[taskIndex], 
            notes: this.editingNotes 
          };
        }
        
        // Show notification
        this.showNotification(`Notes ${this.editingNotes ? 'saved' : 'cleared'} for task: ${this.currentTask.name}`, 'success');
        
        // Close dialog
        this.showNotesDialog = false;
        this.currentTask = null;
        this.editingNotes = '';
        this.noteTaskId = null;
      },
      
      addTask() {
        if (!this.newTaskName) return;

        const task = {
          name: this.newTaskName,
          importance: this.newTaskImportance,
          urgency: this.newTaskUrgency,
          done: false,
          due_date: this.newTaskDueDate,
          notes: this.newTaskNotes,
          parent_id: this.selectedParentId || null
        };

        console.log('Adding new task:', task);
        socket.emit('addTask', task, (res) => {
          console.log('Task added response:', res);
          if (res.success) {
            this.tasks.push(res.task);
            console.log('Tasks count after add:', this.tasks.length);
            console.log('Active tasks count after add:', this.tasks.filter(t => !t.done && !t.parent_id).length);
            
            // Reset form
            this.newTaskName = '';
            this.newTaskImportance = 1;
            this.newTaskUrgency = 1;
            this.newTaskNotes = '';
            this.newTaskDueDate = null;
            this.selectedParentId = null;
            this.closeAddDialog();
          }
        });
      },
      
      updateTask(taskId, updates) {
        this.socket.emit('updateTask', {
          taskId: taskId,
          updates: updates
        });
      },
      
      deleteTask(taskId) {
        this.socket.emit('deleteTask', taskId);
      },
      
      isMongoId(id) {
        return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      },
      
      handleInitialData(data) {
        console.log('Received initial data:', data);
        if (data && data.data) {
          // First pass - collect all originalIds to MongoIDs mapping
          const idMapping = new Map();
          data.data.forEach(task => {
            // Store mapping from originalId to MongoDB _id
            if (task.originalId) {
              idMapping.set(task.originalId, String(task._id));
            }
          });
          
          console.log('ID mapping created:', Array.from(idMapping.entries()));
          
          // Second pass - transform tasks with correct ID references
          const transformedTasks = data.data.map(task => {
            // Convert MongoDB _id to string to ensure consistent comparison
            const taskId = String(task._id);
            
            // Figure out parent_id using originalId -> _id mapping
            let parentId = null;
            if (task.parentId) {
              // First check if parentId is a direct MongoDB ID
              if (data.data.some(t => String(t._id) === task.parentId)) {
                parentId = task.parentId;
              } 
              // Otherwise, treat it as an originalId and look up the corresponding MongoDB ID
              else if (idMapping.has(task.parentId)) {
                parentId = idMapping.get(task.parentId);
                console.log(`Mapped original parentId '${task.parentId}' to MongoDB ID '${parentId}' for task '${task.title}'`);
              } else {
                console.warn(`Cannot find parent with ID '${task.parentId}' for task '${task.title}'`);
              }
            }
            
            return {
              id: taskId,
              original_id: task.originalId || null,
              name: task.title,
              importance: task.importance || 5,
              urgency: task.urgency || 5,
              done: task.completed || false,
              parent_id: parentId,
              created_at: task.createdAt,
              completed_at: task.completedAt,
              due_date: task.dueDate ? new Date(task.dueDate) : null,
              notes: task.notes || '',
              link: task.link || ''
            };
          });
          
          this.tasks = transformedTasks;
          console.log('Tasks updated:', this.tasks);
          
          // Additional debugging information
          console.log('Task parentId status:');
          transformedTasks.forEach(task => {
            console.log(`Task ${task.id} (${task.name}): done=${task.done}, parent_id=${task.parent_id || 'none'}, original_id=${task.original_id || 'none'}`);
          });
          
          // Check parent-child relationships
          const childTasks = transformedTasks.filter(t => t.parent_id);
          console.log(`Found ${childTasks.length} child tasks with parent references`);
          childTasks.forEach(child => {
            const parent = transformedTasks.find(t => t.id === child.parent_id);
            console.log(`Child: ${child.name}, Parent: ${parent ? parent.name : 'NOT FOUND'}`);
          });
          
          // Check active tasks immediately after setting
          const activeTasksCount = transformedTasks.filter(t => !t.done && !t.parent_id).length;
          console.log(`Active tasks count (direct check): ${activeTasksCount}`);
          
          // Show notification with task count info
          this.showNotification(`Loaded ${transformedTasks.length} tasks (${activeTasksCount} active)`, 'info', 2000);
          
          // Force a refresh to ensure computed properties update
          this.refreshTaskList();
          
          // Trigger chart update
          if (chartVisualization && typeof chartVisualization.updateTaskData === 'function') {
            setTimeout(() => chartVisualization.updateTaskData(this.tasks), 100);
          }
        }
      },
      
      buildTaskHierarchy(tasks) {
        console.log('Building task hierarchy from', tasks.length, 'tasks');
        
        // Create a map of tasks by their IDs
        const taskMap = new Map();
        
        // Also create a map by original_id for legacy reference if needed
        const originalIdMap = new Map();
        
        tasks.forEach(task => {
          // Use consistent ID field and ensure it's a string
          const taskId = String(task.id || task._id);
          const taskWithChildren = {
            ...task,
            id: taskId, // Ensure consistent ID field
            children: []
          };
          
          taskMap.set(taskId, taskWithChildren);
          
          // If task has an original_id, also map it
          if (task.original_id) {
            originalIdMap.set(task.original_id, taskWithChildren);
          }
          
          // Debug info
          console.log(`Task ${taskId} (${task.name}): parent_id=${task.parent_id || 'none'}, original_id=${task.original_id || 'none'}`);
        });

        console.log('ID mapping size:', taskMap.size);
        console.log('Original ID mapping size:', originalIdMap.size);

        // Build the hierarchy
        const rootTasks = [];
        taskMap.forEach(task => {
          // Check if task has a parent
          if (task.parent_id) {
            // Convert parent_id to string for consistent comparison
            const parentId = String(task.parent_id);
            console.log(`Looking for parent ${parentId} for task ${task.id} (${task.name})`);
            
            // First try to find parent by direct MongoDB ID
            let parent = taskMap.get(parentId);
            
            // If not found and we have original IDs, try using those
            if (!parent && originalIdMap.has(parentId)) {
              parent = originalIdMap.get(parentId);
              console.log(`Found parent via original_id mapping for ${task.name}`);
            }
            
            if (parent) {
              console.log(`Found parent: ${parent.name} for task: ${task.name}`);
              parent.children.push(task);
            } else {
              console.warn(`Parent not found for task ${task.id} (${task.name}), treating as root`);
              rootTasks.push(task); // If parent not found, treat as root
            }
          } else {
            console.log(`Task ${task.id} (${task.name}) is a root task`);
            rootTasks.push(task);
          }
        });

        console.log('Hierarchy built:', rootTasks.length, 'root tasks');
        console.log('Root tasks:', rootTasks.map(t => t.name));
        rootTasks.forEach(task => {
          if (task.children && task.children.length) {
            console.log(`Task ${task.name} has ${task.children.length} children:`, 
              task.children.map(c => c.name).join(', '));
          }
        });

        return rootTasks;
      }
    },
    mounted() {
      // Initialize socket connection
      this.socket = io();
      
      // Listen for initial data from MongoDB
      this.socket.on('initialData', (data) => {
        this.handleInitialData(data);
      });

      // Listen for task updates
      this.socket.on('taskAdded', (task) => {
        // Transform the new task to match frontend structure
        const newTask = {
          id: task._id,
          name: task.title || task.name,
          importance: task.importance || 5,
          urgency: task.urgency || 5,
          done: task.completed || task.done || false,
          parent_id: task.parentId || task.parent_id || null,
          created_at: task.createdAt || task.created_at,
          completed_at: task.completedAt || task.completed_at,
          due_date: task.dueDate || task.due_date ? new Date(task.dueDate || task.due_date) : null,
          notes: task.notes || '',
          link: task.link || ''
        };
        this.tasks.push(newTask);
        console.log('Task added to UI:', newTask);
      });

      this.socket.on('taskUpdated', (updatedTask) => {
        const index = this.tasks.findIndex(t => t.id === updatedTask._id);
        if (index !== -1) {
          // Transform the updated task
          this.tasks[index] = {
            id: updatedTask._id,
            name: updatedTask.title || updatedTask.name,
            importance: updatedTask.importance || 5,
            urgency: updatedTask.urgency || 5,
            done: updatedTask.completed || updatedTask.done || false,
            parent_id: updatedTask.parentId || updatedTask.parent_id || null,
            created_at: updatedTask.createdAt || updatedTask.created_at,
            completed_at: updatedTask.completedAt || updatedTask.completed_at,
            due_date: updatedTask.dueDate || updatedTask.due_date ? new Date(updatedTask.dueDate || updatedTask.due_date) : null,
            notes: updatedTask.notes || '',
            link: updatedTask.link || ''
          };
          console.log('Task updated in UI:', this.tasks[index]);
        }
      });

      this.socket.on('taskDeleted', (data) => {
        const index = this.tasks.findIndex(t => t.id === data._id);
        if (index !== -1) {
          this.tasks.splice(index, 1);
          console.log('Task deleted from UI:', data._id);
        }
      });
      
      // Listen for updates from task modules
      window.addEventListener('tasksUpdated', (event) => {
        if (event.detail && event.detail.tasks) {
          this.updateTasks(event.detail.tasks);
        }
      });
      
      // Share the Vue instance with modules
      window.taskManager = window.taskManager || {};
      window.taskManager.setVueApp?.(this);
      
      // Initialize chart after Vue is mounted
      setTimeout(() => {
        if (chartVisualization) {
          chartVisualization.initializeChart();
        }
      }, 100);
      
      // Apply dark theme if active
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
      }
      
      // Make app globally available
      window.app = this;
      
      // Dispatch event to signal that app is mounted
      window.dispatchEvent(new Event('app-mounted'));
    }
  });
  
  // Mount Vuetify to the app
  app.use(vuetify);
  
  // Mount the app to the DOM
  app.mount('#app');
  
  // Make app globally available
  window.app = app._instance.proxy;
});

// Now these exports will be valid since the variables are defined at the top level
export {
  chartVisualization,
  taskOperations,
  taskListManager
}; 