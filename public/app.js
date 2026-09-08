import { TaskManager } from './taskManager.js';
import { ChartVisualization } from './modules/chartVisualization.js';
import { lucideSvg } from './modules/lucideIcon.js';
import { TaskOperations } from './modules/taskOperations.js';
import { TaskListManager } from './modules/taskListManager.js';
import { track } from './services/telemetry.js';

// Define these variables at the top level so they can be exported
let chartVisualization = null;
// graph3d.js pulls in the full three.js + addons bundle, so it's loaded on
// demand (see ensureGraph3D) the first time the Graph tab is actually
// opened, instead of on every page load regardless of which tab you land on.
let Graph3D = null;
let graph3d = null;
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
            primary: '#111111',   // editorial ink
            secondary: '#444444',
            accent: '#e5484d',    // signal red
            error: '#e5484d',     // priority ramp: high
            warning: '#f5a623',   // mid
            info: '#6b6b6b',      // low-mid
            success: '#c2c4c4',   // low
            background: '#ffffff',
            surface: '#ffffff',
          },
        },
        dark: {
          colors: {
            primary: '#f2f2f2',
            secondary: '#bdbdbd',
            accent: '#e5484d',
            error: '#e5484d',
            warning: '#f5a623',
            info: '#9a9a9a',
            success: '#6b6b6b',
            background: '#111111',
            surface: '#161616',
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
        navView: 'hierarchy', // left rail: 'hierarchy' | 'settings'
        tasks: [],
        activeTasks: [],
        taskName: '',
        taskImportance: 5,
        taskLink: '',
        taskDueDate: null,
        isDarkTheme: localStorage.getItem('isDarkTheme') === 'true',
        theme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        newSubtask: {
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
        },
        showSubtaskModal: false,
        showWelcomeOverlay: false,
        parentId: null,
        showCompletedSubtasks: false,
        showNotSureTasks: localStorage.getItem('showNotSureTasks') === 'true',
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          parent_id: null,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: []
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
        csvFile: null,
        csvImporting: false,
        csvImportResult: null,
        taskSortBy: localStorage.getItem('taskSortBy') || 'priority-high', // Default sort
        taskSearchQuery: '',
        taskSearchActive: 0,
        leftPanelWidth: parseFloat(localStorage.getItem('leftPanelWidth')) || 55,
        isResizing: false,
        nodeCard: { open: false, x: 0, y: 0, task: null, enables: [] },
        enableQuery: '',
        enableOpen: false,
        enableActive: 0,
        showCsvImportDialog: false,
        showQuickAddModal: false,
        quickAddTask: {
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          link: '',
          notes: '',
          icon: 'mdi-checkbox-blank-circle-outline',
          enables: []
        },
        // Q1 Zoom Mode state
        isQ1ZoomMode: false,
        isChartZoomed: false,
        allRelationships: [],
        availableIcons: [
          'circle-dot', 'star', 'zap', 'flame', 'droplet', 'globe', 'rocket',
          'target', 'flag', 'alert-circle', 'check-circle', 'clock', 'calendar',
          'book-open', 'code', 'laptop', 'phone', 'mail', 'home', 'briefcase',
          'user', 'users', 'heart', 'coffee', 'utensils', 'shopping-cart',
          'banknote', 'trending-up', 'lightbulb', 'sprout', 'cpu', 'megaphone',
          'graduation-cap', 'activity', 'search', 'car', 'trees', 'file-text', 'film'
        ],
        availableColors: [
          { name: 'Red', value: '#FF5252' },
          { name: 'Pink', value: '#E91E63' },
          { name: 'Purple', value: '#9C27B0' },
          { name: 'Deep Purple', value: '#673AB7' },
          { name: 'Indigo', value: '#3F51B5' },
          { name: 'Blue', value: '#2196F3' },
          { name: 'Cyan', value: '#00BCD4' },
          { name: 'Teal', value: '#009688' },
          { name: 'Green', value: '#4CAF50' },
          { name: 'Light Green', value: '#8BC34A' },
          { name: 'Lime', value: '#CDDC39' },
          { name: 'Yellow', value: '#FFEB3B' },
          { name: 'Amber', value: '#FFC107' },
          { name: 'Orange', value: '#FF9800' },
          { name: 'Deep Orange', value: '#FF5722' },
          { name: 'Brown', value: '#795548' },
          { name: 'Grey', value: '#9E9E9E' },
          { name: 'Blue Grey', value: '#607D8B' }
        ],
        // Timer state
        timerInterval: null,
        currentTime: Date.now(),
        completedPomodoros: new Set(),
        showBreakDialog: false,
        breakTask: null,
        breakType: 'short', // 'short' (5min) or 'long' (15min)
        breakTimeRemaining: 0,
        breakInterval: null,
        // Drag and drop state
        draggedTask: null,
        dragOverTaskId: null,
        // Touch reparenting: native HTML5 draggable="true" (used above for
        // mouse) never fires on touch devices, so this is a separate
        // pointer-event gesture (see task-node's startPress/onPressMove) —
        // swipe a row sideways past a small threshold to "detach" it, drag
        // over another row, release to nest under it.
        touchDrag: null,
        expandedTasks: new Set(),
        // Authentication state
        user: null,
        authConfig: {
          googleEnabled: false
        },
        showLoginGate: false,
        isSigningIn: false,
        hoveredTaskId: null,
        heartbeatInterval: null,
        isSessionExpired: false
      };
    },
    computed: {
      taskSortOptions() {
        return [
          { value: 'priority-high', label: 'Priority (High → Low)' },
          { value: 'priority-low', label: 'Priority (Low → High)' },
          { value: 'importance-high', label: 'Importance (High → Low)' },
          { value: 'importance-low', label: 'Importance (Low → High)' },
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'due-date', label: 'Due Date (Closest)' },
          { value: 'name-az', label: 'Name (A → Z)' }
        ];
      },
      hoveredTaskAncestors() {
        if (!this.hoveredTaskId) return new Set();
        const ancestors = new Set();
        let current = this.tasks.find(t => t.id === this.hoveredTaskId);
        while (current && current.parent_id) {
          ancestors.add(current.parent_id);
          current = this.tasks.find(t => t.id === current.parent_id);
        }
        return ancestors;
      },
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      },
      chartStyle() {
        // In split view, chart always fills its container
        return {
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'visible'
        };
      },
      enabledTasks() {
        const byId = new Map((this.tasks || []).map(t => [Number(t.id), t]));
        return this.nodeCard.enables.map(id => byId.get(Number(id))).filter(Boolean);
      },
      nodeCardSubtasks() {
        const task = this.nodeCard.task;
        return task ? this.getSubtasksForTask(task.id) : [];
      },
      enableCandidates() {
        const selfId = this.nodeCard.task ? Number(this.nodeCard.task.id) : null;
        const taken = new Set(this.nodeCard.enables.map(Number));
        return (this.tasks || [])
          .filter(t => !t.done && t.status !== 'Not Sure' && Number(t.id) !== selfId && !taken.has(Number(t.id)))
          .map(t => ({ id: Number(t.id), name: t.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      filteredCandidates() {
        const q = (this.enableQuery || '').trim().toLowerCase();
        if (!q) return this.enableCandidates.slice(0, 60);
        return this.enableCandidates.filter(c => this.matchTask(c.name, q)).slice(0, 60);
      },
      nodeCardStatus() {
        const t = this.nodeCard.task;
        if (!t) return 'todo';
        if (t.done) return 'done';
        if (t.status === 'Not Sure') return 'unsure';
        if (t.status === 'in_progress') return 'in_progress';
        return 'todo';
      },
      activeTasksForLinking() {
        // Get all active tasks that can be linked (for "enables" selection in Quick Add)
        return this.tasks
          .filter(task => !task.done)
          .map(task => ({
            id: task.id,
            name: task.name,
            importance: task.importance,
            urgency: task.urgency
          }));
      },
      activeTimerTask() {
        return this.tasks.find(t => t.active_timer_start);
      },
      activeTasksForEditing() {
        // Get all active tasks excluding the one being edited (for "enables" selection in Edit)
        const editingId = this.editingTask?.id;
        return this.tasks
          .filter(task => !task.done && task.id !== editingId)
          .map(task => ({
            id: task.id,
            name: task.name,
            importance: task.importance,
            urgency: task.urgency
          }));
      },
      sortedActiveTasks() {
        if (!this.activeTasks || this.activeTasks.length === 0) {
          return [];
        }

        let filteredTasks = [...this.activeTasks];

        // Filter out "Not Sure" tasks if hidden
        if (!this.showNotSureTasks) {
          filteredTasks = filteredTasks.filter(task => task.status !== 'Not Sure');
        }
        
        return this.sortTasks(filteredTasks);
      },
      taskSearchResults() {
        const q = this.taskSearchQuery.trim().toLowerCase();
        if (!q) return [];
        return this.tasks
          .filter(t => t.name && t.name.toLowerCase().includes(q))
          .slice(0, 20)
          .map(t => ({ id: t.id, name: t.name, breadcrumb: this.taskBreadcrumb(t) }));
      },
      todayLabel() {
        return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
      },
      allExpanded() {
        const rootTasksWithSubtasks = this.activeTasks.filter(t => this.tasks.some(sub => sub.parent_id === t.id));
        if (rootTasksWithSubtasks.length === 0) return false;
        return rootTasksWithSubtasks.every(t => this.expandedTasks.has(t.id));
      }
    },
    methods: {
      toggleAllExpansion() {
        if (this.allExpanded) {
          this.expandedTasks.clear();
        } else {
          this.activeTasks.forEach(t => {
            if (this.tasks.some(sub => sub.parent_id === t.id)) {
              this.expandedTasks.add(t.id);
            }
          });
        }
        this.expandedTasks = new Set(this.expandedTasks);
      },
      taskBreadcrumb(task) {
        const trail = [];
        let cur = task;
        while (cur && cur.parent_id) {
          cur = this.tasks.find(t => t.id === cur.parent_id);
          if (cur) trail.unshift(cur.name);
        }
        return trail.join(' › ');
      },
      jumpToTask(taskId) {
        let cur = this.tasks.find(t => t.id === taskId);
        while (cur && cur.parent_id) {
          this.expandedTasks.add(cur.parent_id);
          cur = this.tasks.find(t => t.id === cur.parent_id);
        }
        this.expandedTasks = new Set(this.expandedTasks);
        this.taskSearchQuery = '';
        this.$nextTick(() => {
          const el = document.querySelector(`[data-task-id="${taskId}"]`);
          if (!el) return;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('task-jump-highlight');
          setTimeout(() => el.classList.remove('task-jump-highlight'), 1500);
        });
      },
      taskSearchKeydown(e) {
        const list = this.taskSearchResults;
        if (e.key === 'ArrowDown') { e.preventDefault(); this.taskSearchActive = Math.min(this.taskSearchActive + 1, list.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.taskSearchActive = Math.max(this.taskSearchActive - 1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); const r = list[this.taskSearchActive]; if (r) this.jumpToTask(r.id); }
        else if (e.key === 'Escape') { this.taskSearchQuery = ''; }
      },
      sortTasks(tasks) {
        if (!tasks || !Array.isArray(tasks)) return [];
        const sorted = [...tasks];
        
        switch (this.taskSortBy) {
          case 'priority-high':
            return sorted.sort((a, b) => this.queueScore(b) - this.queueScore(a));

          case 'priority-low':
            return sorted.sort((a, b) => this.queueScore(a) - this.queueScore(b));
          
          case 'importance-high':
            return sorted.sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0));
          
          case 'importance-low':
            return sorted.sort((a, b) => (Number(a.importance) || 0) - (Number(b.importance) || 0));

          case 'newest':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          case 'oldest':
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          
          case 'due-date':
            return sorted.sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date) - new Date(b.due_date);
            });
          
          case 'name-az':
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
          
          default:
            return sorted;
        }
      },
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.theme = this.isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('isDarkTheme', this.isDarkTheme);
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Re-render the graph for the new theme
        this.renderGraph();
      },
      
      submitTask() {
        if (!this.taskName) return;
        track('task_add', 'submit');

        const taskData = {
          name: this.taskName,
          importance: this.taskImportance,
          link: this.taskLink || null,
          due_date: this.taskDueDate || null
        };

        taskOperations.addTask(taskData);

        // Reset form
              this.taskName = '';
              this.taskImportance = 5;
        this.taskLink = '';
        this.taskDueDate = null;
      },
      
      toggleTaskDone(task) {
        // If the task has an active timer, stop it before marking as done
        if (!task.done && task.active_timer_start) {
          this.socket.emit('stopTimer', task.id);
          this.showNotification(`Timer stopped for: ${task.name}`, 'info');
        }
        taskOperations.toggleDone(task.id);
      },

      startWorkOnTask(task) {
        // Start timer if not already running
        if (!task.active_timer_start) {
          // Stop other running timers for focus
          this.tasks.forEach(t => {
            if (t.active_timer_start && t.id !== task.id) {
              this.socket.emit('stopTimer', t.id);
            }
          });
          
          this.socket.emit('startTimer', task.id);
          this.showNotification(`Now working on: ${task.name}`, 'success');
        }
        
        // Open link if it exists
        if (task.link) {
          window.open(task.link, '_blank');
        }
      },
      
      deleteTask(taskId, taskName) {
        // One-click delete - no confirmation dialog
        taskOperations.deleteTask(taskId);
        this.showNotification(`Deleted: ${taskName || 'Task'}`, 'info');
      },
      
      getSubtasksForTask(taskId) {
        let subtasks = this.tasks.filter(task => task.parent_id === taskId);
        
        // Filter out "Not Sure" subtasks if hidden
        if (!this.showNotSureTasks) {
          subtasks = subtasks.filter(task => task.status !== 'Not Sure');
        }

        // Debug logging for subtasks with links
        subtasks.forEach(subtask => {
          if (subtask.link) {
            console.log(`UI: Displaying subtask ${subtask.id} with link: ${subtask.link}`);
          }
        });
        
        return subtasks;
      },

      // Flatten a task and its full subtask tree into an indented plain-text
      // outline and copy it to the clipboard — meant for pasting into an AI
      // chat to keep discussing the hierarchy there.
      copyTaskHierarchy(rootTask) {
        const lines = [];
        const walk = (t, depth) => {
          const meta = [];
          if ((t.kind || 'action') !== 'action') meta.push(t.kind);
          if (t.importance != null) meta.push(`importance ${t.importance}`);
          if (t.cost_of_inaction != null) meta.push(`cost of inaction ${t.cost_of_inaction}`);
          if (t.done) meta.push('done');
          else if (t.status === 'Not Sure') meta.push('not sure');
          else if (t.status === 'in_progress') meta.push('doing');
          const suffix = meta.length ? ` (${meta.join(', ')})` : '';
          lines.push(`${'  '.repeat(depth)}- ${t.name}${suffix}`);
          if (t.notes) lines.push(`${'  '.repeat(depth + 1)}note: ${t.notes}`);
          (this.tasks || [])
            .filter((k) => Number(k.parent_id) === Number(t.id))
            .forEach((k) => walk(k, depth + 1));
        };
        walk(rootTask, 0);
        const subCount = lines.filter((l) => /^\s*- /.test(l)).length - 1;
        const msg = subCount > 0
          ? `Copied "${rootTask.name}" + ${subCount} sub-task(s) to clipboard`
          : `Copied "${rootTask.name}" to clipboard`;
        this.copyTextToClipboard(lines.join('\n'), msg);
      },

      copyTextToClipboard(text, successMsg) {
        const onDone = () => this.showNotification(successMsg, 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(onDone).catch(() => this._fallbackCopy(text, onDone));
        } else {
          this._fallbackCopy(text, onDone);
        }
      },
      _fallbackCopy(text, onDone) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          onDone();
        } catch (e) {
          this.showNotification('Copy failed — clipboard not available', 'error');
        }
      },

      showAddSubtaskForm(taskId) {
        this.parentId = taskId;
        const parentTask = this.tasks.find(t => t.id === taskId);
        this.newSubtask = {
          name: '',
          importance: 5.0,
          cost_of_inaction: 5.0,
          link: '',
          due_date: null,
          category: parentTask ? parentTask.category : null
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
          cost_of_inaction: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          category: null
        };
      },
      
      // Opens the node card (metrics, notes, enables, subtasks, kind toggle)
      // next to the tapped row — the same popup the 3D graph used to open on
      // a node click, now the only way in since the graph was removed.
      selectTask(task, ev) {
        const r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect();
        this.openNodeCard({
          taskId: task.id,
          screenX: r ? r.right : window.innerWidth / 2,
          screenY: r ? r.top : window.innerHeight / 2,
          task,
        });
        if (graph3d) graph3d.focusOnTask(task.id);
      },
      // Normal row tap, unless a "Move to another task" is pending — then
      // the tap picks the destination (or cancels, if you tap the task
      // that's being moved).
      onTaskRowClick(task, ev) {
        if (this.touchDrag && this.touchDrag.mode === 'pending') {
          const dragTaskId = this.touchDrag.taskId;
          this.touchDrag = null;
          if (task.id === dragTaskId) return;
          this.touchReparentTask(dragTaskId, task);
          return;
        }
        this.selectTask(task, ev);
      },

      // inline <svg> for a Lucide icon name (old mdi-* values fall back to a dot)
      iconSvg(name) {
        const n = (!name || String(name).startsWith('mdi-')) ? 'circle-dot' : name;
        return lucideSvg(n) || lucideSvg('circle-dot');
      },
      // Priority = cost of inaction x importance, plain and simple. Both are
      // 0..10 fields so the product tops out at 100 — same scale the display
      // bars already assume. Unset COI defaults to a neutral 5.
      queueScore(task) {
        const coi = task.cost_of_inaction == null ? 5 : Number(task.cost_of_inaction);
        const imp = Number(task.importance || 0);
        return coi * imp;
      },
      resetGraphView() {
        if (graph3d) graph3d.resetView();
      },
      // Loads three.js + graph3d.js on first actual need (opening the Graph
      // tab) instead of on every page load. Safe to call repeatedly —
      // resolves immediately once already loaded.
      async ensureGraph3D() {
        if (graph3d) return graph3d;
        try {
          if (!Graph3D) {
            const mod = await import('./modules/graph3d.js');
            Graph3D = mod.Graph3D;
          }
          graph3d = new Graph3D();
          graph3d.init();
        } catch (e) {
          console.error('Failed to load 3D graph module:', e);
        }
        return graph3d;
      },

      renderGraph() {
        if (!graph3d) return;
        try {
          graph3d.showRelationships = true;
          graph3d.showSubtasks = true;
          graph3d.render(this.tasks, this.allRelationships || []);
        } catch (e) {
          console.error('3D graph render failed:', e);
        }
      },

      fetchRelationships() {
        if (this.socket) this.socket.emit('getTaskRelationships', null);
      },
      
      editSubtask(subtask) {
        this.editingSubtask = { ...subtask };
        this.possibleParents = [
          { id: null, name: 'No Parent (Root Task)' },
          ...this.activeTasks.filter(t => t.id !== subtask.id) // Exclude self to avoid circularity
        ];
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name) return;
        
        console.log("UI: Saving subtask edit:");
        console.log("UI: Subtask ID:", this.editingSubtask.id);
        console.log("UI: Subtask link before saving:", this.editingSubtask.link);
        console.log("UI: Subtask parent_id:", this.editingSubtask.parent_id);
        
        // Ensure link is properly formatted
        if (this.editingSubtask.link && typeof this.editingSubtask.link === 'string') {
          // Add http:// prefix if missing
          if (!/^https?:\/\//i.test(this.editingSubtask.link)) {
            this.editingSubtask.link = 'http://' + this.editingSubtask.link;
            console.log("UI: Added http:// prefix to link:", this.editingSubtask.link);
          }
        }
        
        console.log("UI: Final subtask link value being sent:", this.editingSubtask.link);
        
        // Update task content (name, link, etc.)
        taskOperations.updateSubtask(this.editingSubtask);

        // Update parent relationship if changed (including to null)
        const originalTask = this.tasks.find(t => t.id === this.editingSubtask.id);
        if (originalTask && originalTask.parent_id !== this.editingSubtask.parent_id) {
          console.log(`Parent changed from ${originalTask.parent_id} to ${this.editingSubtask.parent_id}`);
          this.socket.emit('setTaskParent', {
            taskId: this.editingSubtask.id,
            parentId: this.editingSubtask.parent_id
          });
        }
        
        this.showNotification("Saving subtask with link: " + (this.editingSubtask.link || "none"), "info");
        
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          parent_id: null,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          category: null
        };
      },
      
      cancelEdit() {
        this.showEditForm = false;
      },
      
      editTask(task) {
        this.editingTask = { ...task, enables: [] };
        // Exclude the task itself and anything already under it — picking
        // one of your own descendants as your new parent would loop.
        this.possibleParents = [
          { id: null, name: 'No Parent (Root Task)' },
          ...this.activeTasks.filter(t => t.id !== task.id && !this.isDescendant(t.id, task.id))
        ];
        this.showTaskEditForm = true;

        // Load current relationships for this task
        this.socket.emit('getTaskRelationships', task.id);
        this.socket.once('taskRelationships', (data) => {
          if (data.taskId === task.id && data.enables) {
            this.editingTask.enables = data.enables.map(t => t.id);
          }
        });
      },
      
      saveTaskEdit() {
        if (!this.editingTask.name) return;
        track('task_edit_save');

        taskOperations.editTask(this.editingTask);

        // Update parent relationship if changed (including to/from root)
        const originalTask = this.tasks.find(t => t.id === this.editingTask.id);
        if (originalTask && originalTask.parent_id !== this.editingTask.parent_id) {
          this.socket.emit('setTaskParent', {
            taskId: this.editingTask.id,
            parentId: this.editingTask.parent_id
          });
        }

        // Update relationships - emit event to update enables
        if (this.editingTask.enables && this.editingTask.enables.length >= 0) {
          this.socket.emit('updateTaskRelationships', {
            taskId: this.editingTask.id,
            enables: this.editingTask.enables
          });
        }

        this.showTaskEditForm = false;
        this.editingTask = {
          id: null,
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: [],
          category: null
        };
      },
      
      cancelTaskEdit() {
        this.showTaskEditForm = false;
      },
      
      toggleNotSureTasks() {
        this.showNotSureTasks = !this.showNotSureTasks;
        localStorage.setItem('showNotSureTasks', this.showNotSureTasks);
        this.renderGraph();

        const msg = this.showNotSureTasks ? 'Showing "Not Sure" tasks' : 'Hiding "Not Sure" tasks';
        this.showNotification(msg, 'info');
      },

      updateTasks(tasks) {
        console.log('updateTasks received:', tasks.length, 'tasks');
        this.tasks = tasks;

        // Keep the open node card pointed at the fresh task object
        if (this.nodeCard.open && this.nodeCard.task) {
          const fresh = tasks.find(t => Number(t.id) === Number(this.nodeCard.task.id));
          if (fresh) this.nodeCard.task = fresh;
          else this.closeNodeCard();
        }
        
        // Helper to check if a task's parent exists
        const parentExists = (parentId) => {
          if (!parentId) return false;
          return tasks.some(t => Number(t.id) === Number(parentId));
        };

        // A task is a "root" if it has no parent_id OR if its parent doesn't exist
        const rawActive = tasks.filter(task => {
          const isRoot = !task.parent_id || !parentExists(task.parent_id);
          const isNotSureHidden = !this.showNotSureTasks && task.status === 'Not Sure';
          return !task.done && isRoot && !isNotSureHidden;
        });

        this.activeTasks = rawActive;

        // Re-render the 3D focus chart FIRST so a downstream error can't skip it
        this.renderGraph();
      },

      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      },

      formatLinkDisplay(url) {
        if (!url) return 'No link';
        try {
          const urlObj = new URL(url);
          let displayText = urlObj.hostname;
          if (urlObj.pathname && urlObj.pathname !== '/') {
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
          return url.length > 20 ? url.substring(0, 18) + '...' : url;
        }
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
        const socket = this.socket || window.socket;
        if (socket) {
          socket.emit('getTaskDetails', { taskId: task.id });
          socket.once('taskDetails', (taskData) => {
            if (taskData && taskData.id === task.id) {
              this.currentTask = taskData;
              this.editingNotes = taskData.notes || '';
              this.noteTaskId = task.id;
              this.showNotesDialog = true;
            }
          });
        }
      },
      
      saveTaskNotes() {
        if (!this.currentTask) return;
        taskOperations.updateTaskNotes(this.currentTask.id, this.editingNotes);
        const taskIndex = this.tasks.findIndex(t => t.id === this.currentTask.id);
        if (taskIndex >= 0) {
          this.tasks[taskIndex] = { ...this.tasks[taskIndex], notes: this.editingNotes };
        }
        this.showNotesDialog = false;
      },

      closeNotesDialog() {
        this.showNotesDialog = false;
        this.editingNotes = '';
        this.currentTask = null;
      },

      async importCSV() {
        if (!this.csvFile) {
          this.showNotification('Please select a CSV file', 'error');
          return;
        }
        this.csvImporting = true;
        try {
          const formData = new FormData();
          formData.append('csvFile', this.csvFile[0]);
          const response = await fetch('/api/import-csv', { method: 'POST', body: formData });
          const result = await response.json();
          if (response.ok) {
            this.showNotification(result.message, 'success');
            this.csvFile = null;
            setTimeout(() => { this.showCsvImportDialog = false; }, 2000);
          } else {
            this.showNotification('Failed to import CSV: ' + (result.message || 'Unknown error'), 'error');
          }
        } catch (error) {
          this.showNotification('Error uploading CSV file', 'error');
        } finally {
          this.csvImporting = false;
        }
      },

      exportTasks() {
        const tasks = this.tasks;
        if (!tasks || tasks.length === 0) {
          this.showNotification('No tasks to export', 'warning');
          return;
        }
        const headers = ['id', 'name', 'importance', 'urgency', 'done', 'link', 'due_date', 'notes', 'parent_id', 'created_at', 'completed_at', 'total_time_spent', 'pomodoro_count', 'category', 'status'];
        const csvRows = [headers.join(',')];
        for (const task of tasks) {
          const values = headers.map(header => {
            let val = task[header] ?? '';
            if (header === 'done') val = val ? 'true' : 'false';
            let stringVal = val.toString();
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
              stringVal = `"${stringVal.replace(/"/g, '""')}"`;
            }
            return stringVal;
          });
          csvRows.push(values.join(','));
        }
        const csvContent = "\uFEFF" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `tasks-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
        this.showNotification('Tasks exported successfully', 'success');
      },


      openQuickAddModal(importance) {
        track('quick_add_open');
        this.quickAddTask.importance = importance || 5;
        this.quickAddTask.cost_of_inaction = 5;
        this.quickAddTask.name = '';
        this.quickAddTask.link = '';
        this.quickAddTask.notes = '';
        this.quickAddTask.enables = [];
        this.showQuickAddModal = true;
      },

      bumpQuick(field, delta) {
        const next = Math.max(0, Math.min(10, Math.round(Number(this.quickAddTask[field] || 0) + delta)));
        this.quickAddTask[field] = next;
      },

      submitQuickTask() {
        if (!this.quickAddTask.name) {
          this.showNotification('Please enter a task name', 'error');
          return;
        }

        const taskData = {
          name: this.quickAddTask.name,
          importance: this.quickAddTask.importance,
          cost_of_inaction: this.quickAddTask.cost_of_inaction,
          link: this.quickAddTask.link || null,
          notes: this.quickAddTask.notes || null,
          icon: this.quickAddTask.icon || 'mdi-checkbox-blank-circle-outline',
          color: this.quickAddTask.color || null
        };

        const enables = this.quickAddTask.enables || [];

        // If there are relationships, use the new socket event
        if (enables.length > 0) {
          this.socket.emit('addTaskWithRelationships', { task: taskData, enables });
        } else {
          // Use taskOperations for simple task addition
          taskOperations.addTask(taskData);
        }
        this.showNotification(`Added: ${taskData.name}`, 'success');

        // Close modal and reset
        this.showQuickAddModal = false;
        this.quickAddTask = {
          name: '',
          importance: 5,
          cost_of_inaction: 5,
          link: '',
          notes: '',
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: []
        };
      },

      toggleQ1ZoomMode() {
        if (this.isChartZoomed || this.isQ1ZoomMode) {
          // Reset zoom
          this.isQ1ZoomMode = false;
          this.isChartZoomed = false;
          if (chartVisualization) {
            chartVisualization.resetZoom();
          }
          this.showNotification('Zoom reset to normal view', 'info');
        } else {
          // Enable Q1 zoom
          this.isQ1ZoomMode = true;
          this.isChartZoomed = true;
          if (chartVisualization) {
            chartVisualization.toggleQ1ZoomMode();
          }
          this.showNotification('Q1 Zoom Mode enabled - showing tasks 5-10', 'info');
        }
      },

      zoomIn() {
        if (chartVisualization) {
          chartVisualization.zoomIn();
        }
      },

      zoomOut() {
        if (chartVisualization) {
          chartVisualization.zoomOut();
        }
      },

      closeQuickAddModal() {
        this.showQuickAddModal = false;
      },

      // Pomodoro Timer Methods
      toggleTimer(task) {
        if (task.active_timer_start) {
          // Stop timer
          this.socket.emit('stopTimer', task.id);
          this.showNotification(`Timer stopped for: ${task.name}`, 'info');
        } else {
          // Start timer
          this.socket.emit('startTimer', task.id);
          this.showNotification(`Timer started for: ${task.name}`, 'success');
        }
      },

      formatTime(seconds) {
        if (!seconds) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
          return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
      },

      getElapsedTime(startTime) {
        if (!startTime) return 0;
        const start = new Date(startTime).getTime();
        const now = this.currentTime;
        return Math.floor((now - start) / 1000);
      },

      startTimerUpdates() {
        // Update current time every second for active timers
        this.timerInterval = setInterval(() => {
          this.currentTime = Date.now();
          this.checkPomodoroCompletion();
        }, 1000);
      },

      checkPomodoroCompletion() {
        // Check if any task has reached 25 minutes
        const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
        
        this.tasks.forEach(task => {
          if (task.active_timer_start) {
            const elapsed = this.getElapsedTime(task.active_timer_start);
            const pomodoroKey = `${task.id}-${task.active_timer_start}`;
            
            // Check if this specific pomodoro session just completed
            if (elapsed >= POMODORO_DURATION && !this.completedPomodoros.has(pomodoroKey)) {
              this.completedPomodoros.add(pomodoroKey);
              this.onPomodoroComplete(task);
            }
          }
        });
      },

      onPomodoroComplete(task) {
        // Auto-stop the timer
        this.socket.emit('stopTimer', task.id);
        
        // Play chime sound
        this.playCompletionChime();
        
        // Show break dialog
        this.breakTask = task;
        // Every 4th pomodoro gets a long break
        this.breakType = (task.pomodoro_count % 4 === 0) ? 'long' : 'short';
        this.showBreakDialog = true;
        
        // Show notification
        this.showNotification(`🍅 Pomodoro completed for: ${task.name}! Time for a break!`, 'success');
      },

      playCompletionChime() {
        // Create a pleasant chime sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a pleasant three-tone chime
        const playTone = (frequency, startTime, duration) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };
        
        const now = audioContext.currentTime;
        playTone(523.25, now, 0.3);        // C5
        playTone(659.25, now + 0.15, 0.3); // E5
        playTone(783.99, now + 0.3, 0.5);  // G5
      },

      startBreak() {
        const duration = this.breakType === 'long' ? 15 * 60 : 5 * 60; // seconds
        this.breakTimeRemaining = duration;
        this.showBreakDialog = false;
        
        // Store break start time in localStorage for persistence
        const breakData = {
          startTime: Date.now(),
          duration: duration,
          taskName: this.breakTask ? this.breakTask.name : 'Task'
        };
        localStorage.setItem('activeBreak', JSON.stringify(breakData));
        
        // Start break timer
        this.breakInterval = setInterval(() => {
          this.breakTimeRemaining--;
          if (this.breakTimeRemaining <= 0) {
            this.endBreak();
          }
        }, 1000);
        
        const breakLength = this.breakType === 'long' ? '15 min' : '5 min';
        this.showNotification(`☕ Break started (${breakLength}). Relax!`, 'info');
      },

      skipBreak() {
        this.showBreakDialog = false;
        this.breakTask = null;
      },

      endBreak() {
        if (this.breakInterval) {
          clearInterval(this.breakInterval);
          this.breakInterval = null;
        }
        this.breakTimeRemaining = 0;
        
        // Clear break from localStorage
        localStorage.removeItem('activeBreak');
        
        // Play completion chime
        this.playCompletionChime();
        
        // Notify user
        this.showNotification('✅ Break complete! Ready for another Pomodoro?', 'success');
      },
      
      // Restore break timer if it was active
      restoreBreakTimer() {
        const breakData = localStorage.getItem('activeBreak');
        if (!breakData) return;
        
        try {
          const { startTime, duration, taskName } = JSON.parse(breakData);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = duration - elapsed;
          
          if (remaining > 0) {
            // Break is still active
            this.breakTimeRemaining = remaining;
            
            // Restart interval
            this.breakInterval = setInterval(() => {
              this.breakTimeRemaining--;
              if (this.breakTimeRemaining <= 0) {
                this.endBreak();
              }
            }, 1000);
            
            console.log(`Restored break timer: ${remaining}s remaining for ${taskName}`);
          } else {
            // Break should have ended while away
            localStorage.removeItem('activeBreak');
            this.showNotification('✅ Break completed while you were away!', 'success');
            this.playCompletionChime();
          }
        } catch (error) {
          console.error('Error restoring break timer:', error);
          localStorage.removeItem('activeBreak');
        }
      },

      stopTimerUpdates() {
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
      },

      // Resize panel methods
      startResize(e) {
        this.isResizing = true;
        const move = (e) => {
          if (!this.isResizing) return;
          const rect = this.$refs.splitContainer.getBoundingClientRect();
          const width = ((e.clientX - rect.left) / (rect.width || 1)) * 100;
          if (width >= 30 && width <= 70) {
            this.leftPanelWidth = width;
          }
        };
        const stop = () => {
          this.isResizing = false;
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', stop);
          localStorage.setItem('leftPanelWidth', this.leftPanelWidth);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
      },

      // --- 3D graph: scroll story + floating node card ---
      scrollToTable() {
        const el = this.$refs.rightPanel;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },

      openNodeCard(detail) {
        const task = (this.tasks || []).find(t => Number(t.id) === Number(detail.taskId)) || detail.task;
        if (!task) return;
        track('node_card_open', task.kind || 'action');
        const m = 12;
        const x = Math.min(Math.max(detail.screenX + 16, m), window.innerWidth - 300 - m);
        const y = Math.max(detail.screenY - 20, m);
        this.nodeCard = { open: true, x, y, task, enables: [] };

        // clamp against the card's real size once it renders, so nothing spills off-screen
        this.$nextTick(() => {
          const el = this.$refs.nodeCardEl;
          if (!el) return;
          const h = el.offsetHeight, w = el.offsetWidth;
          this.nodeCard.x = Math.min(Math.max(this.nodeCard.x, m), Math.max(m, window.innerWidth - w - m));
          this.nodeCard.y = Math.min(Math.max(this.nodeCard.y, m), Math.max(m, window.innerHeight - h - m));
        });

        // load which tasks this one makes easier ("enables")
        if (this.socket) {
          this.socket.emit('getTaskRelationships', task.id);
          this.socket.once('taskRelationships', (data) => {
            if (this.nodeCard.open && this.nodeCard.task
              && Number(data.taskId) === Number(this.nodeCard.task.id) && Array.isArray(data.enables)) {
              this.nodeCard.enables = data.enables.map(t => Number(t.id));
            }
          });
        }
      },

      closeNodeCard() {
        this.nodeCard = { ...this.nodeCard, open: false, task: null, enables: [] };
        this.enableQuery = '';
        this.enableOpen = false;
        this.enableActive = 0;
        if (graph3d) graph3d.focusOnTask(null);
      },

      // Hangul chosung (leading consonant) extraction for fast fuzzy search
      chosung(str) {
        const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        let out = '';
        for (const ch of String(str)) {
          const code = ch.charCodeAt(0) - 0xac00;
          out += (code >= 0 && code < 11172) ? CHO[Math.floor(code / 588)] : ch.toLowerCase();
        }
        return out;
      },
      matchTask(name, q) {
        const n = String(name).toLowerCase();
        if (n.includes(q)) return true;
        // any Hangul in the query -> compare by chosung, so "ㄴㅈ" or "농ㅈ" finds "농장"
        if (/[가-힣ㄱ-ㅎ]/.test(q)) {
          return this.chosung(name).replace(/\s/g, '').includes(this.chosung(q).replace(/\s/g, ''));
        }
        return false;
      },
      pickEnable(id) {
        track('relationship_add');
        this.addEnable(id);
        this.enableQuery = '';
        this.enableActive = 0;
        this.$nextTick(() => { const el = this.$refs.enableInput; if (el) el.focus(); });
      },
      enableKeydown(e) {
        const list = this.filteredCandidates;
        if (e.key === 'ArrowDown') { e.preventDefault(); this.enableActive = Math.min(this.enableActive + 1, list.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.enableActive = Math.max(this.enableActive - 1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); const c = list[this.enableActive]; if (c) this.pickEnable(c.id); }
        else if (e.key === 'Escape') { this.enableOpen = false; }
      },
      enableBlur() {
        setTimeout(() => { this.enableOpen = false; }, 120);
      },

      addEnable(id) {
        id = Number(id);
        if (!id || this.nodeCard.enables.includes(id)) return;
        this.nodeCard.enables.push(id);
        this.commitEnables();
      },
      removeEnable(id) {
        this.nodeCard.enables = this.nodeCard.enables.filter(x => x !== Number(id));
        this.commitEnables();
      },
      commitEnables() {
        const task = this.nodeCard.task;
        if (!task || !this.socket) return;
        clearTimeout(this._enablesTimer);
        const enables = [...this.nodeCard.enables];
        this._enablesTimer = setTimeout(() => {
          this.socket.emit('updateTaskRelationships', { taskId: task.id, enables });
        }, 300);
      },

      selectQueueTask(task, ev) {
        if (!task) return;
        track('queue_click', task.kind || 'action');
        const r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect();
        this.openNodeCard({
          taskId: task.id,
          screenX: r ? r.right : window.innerWidth / 2,
          screenY: r ? r.top : window.innerHeight / 2,
          task,
        });
        if (graph3d) graph3d.focusOnTask(task.id);
      },

      bumpMetric(field, delta) {
        const task = this.nodeCard.task;
        if (!task) return;
        const next = Math.max(0, Math.min(10, Math.round(Number(task[field] || 0) + delta)));
        if (next === Number(task[field])) return;
        track('metric_bump', field, { delta });
        task[field] = next;
        if (graph3d) this.renderGraph();
        this.commitNodeCard();
      },

      setNodeKind(kind) {
        const task = this.nodeCard.task;
        if (!task || (task.kind || 'action') === kind) return;
        track('set_kind', kind);
        task.kind = kind;
        if (graph3d) this.renderGraph();
        this.commitNodeCard();
      },

      commitNodeCard() {
        const task = this.nodeCard.task;
        if (!task) return;
        clearTimeout(this._nodeCardTimer);
        this._nodeCardTimer = setTimeout(() => {
          taskOperations.editTask({ ...task });
        }, 350);
      },

      setNodeStatus(state) {
        const task = this.nodeCard.task;
        if (!task) return;
        track('set_status', state);
        const wantDone = state === 'done';
        const status = state === 'in_progress' ? 'in_progress' : state === 'unsure' ? 'Not Sure' : '';
        if (wantDone !== !!task.done) taskOperations.toggleDone(task.id);
        this.socket.emit('updateTaskStatus', { taskId: task.id, status });
        task.done = wantDone;
        task.status = status;
        const label = { todo: 'To Do', in_progress: 'Doing', done: 'Done', unsure: 'Unsure' }[state] || state;
        this.showNotification(`"${task.name}" → ${label}`, 'info');
        if (graph3d) this.renderGraph(); // done / Not Sure tasks drop off the chart at once; server echo confirms
        this.closeNodeCard();
      },

      deleteNodeCardTask() {
        const task = this.nodeCard.task;
        if (!task) return;
        this.deleteTask(task.id, task.name);
        this.closeNodeCard();
      },

      editNodeCardTask() {
        const task = this.nodeCard.task;
        this.closeNodeCard();
        if (task) this.editTask(task);
      },

      handleDragStart(task, event) {
        console.log("Dragging task:", task.id, task.name);
        this.draggedTask = task;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        
        // Add dragging class for visual feedback
        setTimeout(() => {
          if (event.target && event.target.classList) {
            event.target.classList.add('dragging');
          }
        }, 0);
      },

      handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Find the task element being dragged over
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) {
          const taskId = parseInt(taskEl.dataset.taskId || taskEl.dataset.subtaskId);
          if (taskId && this.draggedTask && taskId !== this.draggedTask.id) {
            this.dragOverTaskId = taskId;
            taskEl.classList.add('drag-over');
          }
        }
        return false;
      },

      handleDragLeave(event) {
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) {
          taskEl.classList.remove('drag-over');
        }
      },

      handleDropOnTask(parentTask, event) {
        event.stopPropagation();
        event.preventDefault();
        
        // Clear drag-over styling
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) taskEl.classList.remove('drag-over');

        if (!this.draggedTask || this.draggedTask.id === parentTask.id) {
          return;
        }

        // Prevent circular reference
        if (this.isDescendant(parentTask.id, this.draggedTask.id)) {
          this.showNotification('Cannot create circular reference!', 'error');
          return;
        }

        console.log(`Setting parent of ${this.draggedTask.id} to ${parentTask.id}`);
        this.socket.emit('setTaskParent', {
          taskId: this.draggedTask.id,
          parentId: parentTask.id
        });

        // Auto-expand parent to show new subtask
        this.expandedTasks.add(parentTask.id);
        this.expandedTasks = new Set(this.expandedTasks);

        this.showNotification(`Moved "${this.draggedTask.name}" under "${parentTask.name}"`, 'success');
      },

      handleDropOnRoot(event) {
        event.preventDefault();
        event.target.classList.remove('drag-over');
        
        if (!this.draggedTask) return;

        console.log(`Moving ${this.draggedTask.id} to root level`);
        this.socket.emit('setTaskParent', {
          taskId: this.draggedTask.id,
          parentId: null
        });

        this.showNotification(`Moved "${this.draggedTask.name}" to root level`, 'info');
      },

      handleDragEnd(event) {
        if (event.target && event.target.classList) {
          event.target.classList.remove('dragging');
        }
        
        // Remove drag-over class from all elements
        document.querySelectorAll('.task, .subtask, .empty-drop-area, #empty-drop-area').forEach(el => {
          el.classList.remove('drag-over');
        });
        
        this.draggedTask = null;
        this.dragOverTaskId = null;
      },

      touchReparentTask(taskId, parentTask) {
        const dragged = this.tasks.find(t => t.id === taskId);
        if (!dragged || !parentTask || dragged.id === parentTask.id) return;
        if (this.isDescendant(parentTask.id, dragged.id)) {
          this.showNotification('Cannot create circular reference!', 'error');
          return;
        }
        this.socket.emit('setTaskParent', { taskId: dragged.id, parentId: parentTask.id });
        this.expandedTasks.add(parentTask.id);
        this.expandedTasks = new Set(this.expandedTasks);
        this.showNotification(`Moved "${dragged.name}" under "${parentTask.name}"`, 'success');
      },
      isDescendant(taskId, potentialAncestorId) {
        let currentTask = this.tasks.find(t => t.id === taskId);
        
        while (currentTask && currentTask.parent_id) {
          if (currentTask.parent_id === potentialAncestorId) {
            return true;
          }
          currentTask = this.tasks.find(t => t.id === currentTask.parent_id);
        }
        
        return false;
      },

      toggleExpand(taskId, force) {
        if (force === true) {
          this.expandedTasks.add(taskId);
        } else if (force === false) {
          this.expandedTasks.delete(taskId);
        } else {
          if (this.expandedTasks.has(taskId)) {
            this.expandedTasks.delete(taskId);
          } else {
            this.expandedTasks.add(taskId);
          }
        }
        // Force reactivity update for Set
        this.expandedTasks = new Set(this.expandedTasks);
      },

      isExpanded(taskId) {
        return this.expandedTasks.has(taskId);
      },

      toggleNotSure(task) {
        taskOperations.toggleTaskStatus(task.id, task.status);
        const statusMsg = task.status === 'Not Sure' ? 'Cleared "Not Sure" status' : 'Tagged as "Not Sure"';
        this.showNotification(`${statusMsg}: ${task.name}`, 'info');
      },

      // "Focus" tasks are the deliberately curated few that get a spot on
      // the 3D chart — see graph3d.js. Everything else stays off it.
      toggleTaskFocus(task) {
        if (!this.socket) return;
        const next = !task.is_focus;
        task.is_focus = next;
        this.socket.emit('toggleTaskFocus', { taskId: task.id, isFocus: next });
        this.showNotification(next ? `"${task.name}" added to focus chart` : `"${task.name}" removed from focus chart`, 'info');
        this.renderGraph();
      },
      toggleNodeFocus() {
        const task = this.nodeCard.task;
        if (task) this.toggleTaskFocus(task);
      },

      // Authentication methods
      async checkAuth() {
        try {
          // Fetch auth config if not already fetched
          if (!this.authConfig.googleEnabled) {
            const configResponse = await fetch('/api/auth/config');
            if (configResponse.ok) {
              this.authConfig = await configResponse.json();
            }
          }

          // Fetch current user
          const response = await fetch('/api/auth/user');
          if (response.ok) {
            const userData = await response.json();
            this.user = userData;
            this.isSessionExpired = false;
            this.showLoginGate = false;
            console.log('User authenticated:', this.user);

            // Authenticate socket connection
            this.authenticateSocket();
          } else {
            if (this.user) {
              // User was logged in but session expired
              this.isSessionExpired = true;
              this.showNotification('Session expired. Please log in again to save your progress.', 'warning', 10000);
            }
            this.user = null;
          }
          
          // Always start heartbeat to keep server awake and session fresh
          this.startHeartbeat();
        } catch (error) {
          console.error('Error checking auth:', error);
          // Start heartbeat anyway to try and maintain connection
          this.startHeartbeat();
        }
      },

      authenticateSocket() {
        if (this.socket && this.user && this.user.id) {
          console.log('Authenticating socket for user:', this.user.id);
          this.socket.emit('authenticate', this.user.id);
        }
      },

      startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        console.log('Starting heartbeat to keep session/server alive');
        // Ping every 4 minutes to keep session active (especially for Render spin-down)
        this.heartbeatInterval = setInterval(async () => {
          try {
            const response = await fetch('/api/auth/heartbeat');
            const wasLoggedIn = !!this.user;
            
            if (response.ok) {
              const data = await response.json();
              if (!wasLoggedIn && data.authenticated) {
                // Unexpectedly logged in (maybe in another tab)
                this.checkAuth();
              }
              this.isSessionExpired = false;
            } else if (response.status === 401) {
              if (wasLoggedIn) {
                console.warn('Heartbeat: Session expired');
                this.user = null;
                this.isSessionExpired = true;
                this.showNotification('Session expired. Please log in again.', 'warning');
                // Don't clear interval, keep pinging to keep server awake
              }
            }
          } catch (error) {
            console.error('Heartbeat error:', error);
          }
        }, 4 * 60 * 1000); 
      },

      loginWithGoogle() {
        if (this.isSigningIn) return;
        this.isSigningIn = true;
        window.location.href = '/auth/google';
      },

      logout() {
        window.location.href = '/auth/logout';
      },

      updateTaskIcon(task, icon) {
        // Emit specific event for icon update
        this.socket.emit('updateTaskIcon', { taskId: task.id, icon: icon });
        
        // Immediate local update for UI responsiveness
        task.icon = icon;
        this.showNotification('Icon updated', 'success');
      },

      updateTaskColor(task, color) {
        // Emit specific event for color update
        this.socket.emit('updateTaskColor', { taskId: task.id, color: color });
        
        // Immediate local update for UI responsiveness
        task.color = color;
        this.showNotification('Color updated', 'success');
      },

      getPriorityColor(value) {
        if (value >= 8) return 'error';
        if (value >= 6) return 'warning';
        if (value >= 4) return 'info';
        return 'success';
      },


      checkFirstVisit() {
        const hasVisited = localStorage.getItem('hasVisitedPriorityManager');
        if (!hasVisited) {
          this.showWelcomeOverlay = true;
        }
      },

      dismissWelcome() {
        this.showWelcomeOverlay = false;
        localStorage.setItem('hasVisitedPriorityManager', 'true');
        
        // If they have no tasks, offer to create demo tasks
        if (this.tasks.length === 0) {
          this.createDemoTasks();
        }
      },

      createDemoTasks() {
        const demoTasks = [
          { name: '🚀 Drag me on the chart to prioritize', importance: 8, urgency: 8, icon: 'mdi-rocket', notes: 'This is an Important & Urgent task (Q1).' },
          { name: '🍅 Start a Pomodoro on me', importance: 9, urgency: 4, icon: 'mdi-timer', notes: 'Click the play button to start focus time.' },
          { name: '🔗 Double-click me to add subtasks', importance: 5, urgency: 3, icon: 'mdi-sitemap', notes: 'Break big goals into smaller steps.' }
        ];

        demoTasks.forEach(task => {
          taskOperations.addTask(task);
        });

        this.showNotification('Demo tasks created! Try dragging them.', 'success');
      },

    },
    watch: {
      taskSortBy(newValue) {
        // Save sort preference to localStorage
        localStorage.setItem('taskSortBy', newValue);
      },
      enableQuery() {
        this.enableActive = 0;
      },
      taskSearchQuery() {
        this.taskSearchActive = 0;
      },
      navView(v) {
        track('view', v);
        const onGraph = v === 'graph';
        if (onGraph) {
          this.ensureGraph3D().then((g3d) => {
            if (!g3d) return;
            g3d.setActive(true);
            this.$nextTick(() => { g3d.resize(); this.renderGraph(); });
          });
        } else if (graph3d) {
          graph3d.setActive(false);
        }
      }
    },
    provide() {
      return {
        openQuickAddModal: this.openQuickAddModal,
        isQ1ZoomMode: () => this.isQ1ZoomMode
      };
    },
    beforeUnmount() {
      // Clean up resize listeners
      if (this.isResizing) {
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mouseup', this.stopResize);
      }
      // Clean up timer interval
      this.stopTimerUpdates();
      // Clean up heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    },
    mounted() {
      // Make app globally available FIRST
      window.app = this;

      // Step-by-step splash status instead of a static "Preparing..." — the
      // actual slow part is usually a cold Render instance waking up, which
      // we can't speed up, but we CAN show which real step we're on instead
      // of a spinner that looks frozen. Hidden once real data (or the login
      // gate) is ready, with a patience message + a hard timeout so a
      // never-resolving edge case doesn't leave the splash up forever.
      const splashStatusEl = document.getElementById('splash-status');
      const splashBarEl = document.getElementById('splash-bar');
      let splashDone = false;
      const splashStep = (pct, text) => {
        if (splashDone) return;
        if (splashBarEl) splashBarEl.style.width = pct + '%';
        if (splashStatusEl) splashStatusEl.textContent = text;
      };
      const hideSplash = () => {
        if (splashDone) return;
        splashDone = true;
        clearTimeout(this._splashPatienceTimer);
        clearTimeout(this._splashForceTimer);
        const splash = document.getElementById('splash-screen');
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(() => splash.remove(), 400);
        }
      };
      splashStep(15, '앱을 준비하는 중…');
      // Cold Render instance can take 30-60s to wake — after a few seconds,
      // say so explicitly instead of letting the bar just sit there.
      this._splashPatienceTimer = setTimeout(() => {
        splashStep(70, '서버가 깨어나는 중이에요. 평소보다 조금 걸릴 수 있어요…');
      }, 6000);
      // Absolute ceiling: never leave the user staring at the splash forever.
      this._splashForceTimer = setTimeout(hideSplash, 25000);

      // Surface a failed Google sign-in instead of silently landing back on
      // the login gate with no explanation (common on Render's free-tier
      // cold starts, where the first attempt can time out).
      const loginError = new URLSearchParams(window.location.search).get('login_error');
      if (loginError) {
        this.showNotification('Sign-in failed (' + loginError + '). The server may still be waking up — please try again.', 'error', 8000);
        const url = new URL(window.location.href);
        url.searchParams.delete('login_error');
        window.history.replaceState({}, '', url);
      }

      // Check authentication
      this.checkAuth();

      // Only load the 3D graph (three.js + addons) up front when it's
      // actually the tab you land on (desktop default) — otherwise it loads
      // lazily the first time you open the Graph tab (see the navView watcher).
      this.$nextTick(async () => {
        if (this.navView === 'graph') {
          const g3d = await this.ensureGraph3D();
          if (g3d) this.renderGraph();
        }

        // Floating node card: driven by clicks inside the 3D graph
        this._onNodeSelect = (e) => this.openNodeCard(e.detail);
        this._onNodeDeselect = () => { if (this.nodeCard.open) this.closeNodeCard(); };
        window.addEventListener('node:select', this._onNodeSelect);
        window.addEventListener('node:deselect', this._onNodeDeselect);

        // Esc closes the top-most open thing
        this._onKeyEsc = (e) => {
          if (e.key !== 'Escape') return;
          if (this.enableOpen) { this.enableOpen = false; return; }
          if (this.showQuickAddModal) { this.showQuickAddModal = false; return; }
          if (this.showTaskEditForm) { this.showTaskEditForm = false; return; }
          if (this.showSubtaskModal) { this.showSubtaskModal = false; return; }
          if (this.showCsvImportDialog) { this.showCsvImportDialog = false; return; }
          if (this.nodeCard.open) { this.closeNodeCard(); return; }
        };
        window.addEventListener('keydown', this._onKeyEsc);

        // Pause the WebGL render loop when the graph panel scrolls out of
        // view (or the tab switches away from it) — but note the node card
        // is no longer graph-exclusive (Active Tasks rows open it too), so
        // this must NOT auto-close it just because the graph panel is
        // hidden.
        const hero = this.$refs.leftPanel;
        const scroller = this.$refs.splitContainer;
        if (hero && 'IntersectionObserver' in window) {
          this._heroObserver = new IntersectionObserver((entries) => {
            const visible = entries.some(en => en.isIntersecting);
            if (graph3d) { graph3d.setActive(visible); if (visible) graph3d.resize(); }
          }, { root: scroller || null, threshold: 0.15 });
          this._heroObserver.observe(hero);
        }
      });

      splashStep(35, '서버에 연결하는 중…');
      this.socket = io(window.location.origin, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      // Listen for socket connection and request data
      this.socket.on('connect', () => {
        console.log('Socket connected, checking auth');
        splashStep(65, '로그인 확인하는 중…');
        // If we have a user, authenticate. authenticate will trigger initialData fetch.
        // If no user, request initialData (public tasks).
        if (this.user && this.user.id) {
          this.authenticateSocket();
        } else {
          this.socket.emit('requestInitialData');
        }
        this.fetchRelationships();
      });

      // Server says this connection is anonymous and Google sign-in is
      // required (it won't hand out task data over the socket either way).
      this.socket.on('authRequired', () => {
        this.showLoginGate = true;
        hideSplash();
      });

      // All enabler->enabled relationships
      this.socket.on('taskRelationships', (data) => {
        if (data && data.taskId == null && Array.isArray(data.relationships)) {
          this.allRelationships = data.relationships;
          this.renderGraph();
        }
      });
      this.socket.on('relationshipAdded', () => this.fetchRelationships());
      this.socket.on('relationshipRemoved', () => this.fetchRelationships());
      
      this.socket.on('reconnect', () => {
        console.log('Socket reconnected');
        this.authenticateSocket();
      });
      
      // Handle initial data and updates
      this.socket.on('initialData', (data) => {
        console.log('Received initial data:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
      });
      
      this.socket.on('updateTasks', (data) => {
        console.log('Received task update:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
        this.fetchRelationships();
        splashStep(100, '준비 완료!');
        hideSplash();
      });

      this.socket.on('error', ({ message }) => {
        this.showNotification(message || "An error occurred", "error");
      });

      this.socket.on('csvImported', (result) => {
        console.log('CSV import completed:', result);
        // Refresh the task list
        this.socket.emit('updateTasks');
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
      
      // Apply dark theme if active
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
      }
      
      // Start timer updates for active timers
      this.startTimerUpdates();
      
      // Check if first time user
      this.checkFirstVisit();

      // Restore break timer if it was active (handles page navigation/refresh)
      this.restoreBreakTimer();
      
      // Dispatch event to signal that app is mounted
      window.dispatchEvent(new Event('app-mounted'));
    },
    beforeUnmount() {
      // Clean up timer interval
      this.stopTimerUpdates();
      // Clean up 3D graph wiring
      if (this._onNodeSelect) window.removeEventListener('node:select', this._onNodeSelect);
      if (this._onNodeDeselect) window.removeEventListener('node:deselect', this._onNodeDeselect);
      if (this._onKeyEsc) window.removeEventListener('keydown', this._onKeyEsc);
      if (this._heroObserver) this._heroObserver.disconnect();
      if (graph3d) graph3d.dispose();
    }
  });
  
  // Define recursive task-node component
  app.component('task-node', {
    props: ['task', 'depth', 'tasks', 'expandedTasks', 'showCompletedSubtasks'],
    data() {
      return {
        longPressTimer: null,
        longPressMenu: false,
        radialSubPanel: null,
        menuX: 0,
        menuY: 0,
        isPressing: false
      };
    },
    template: `
      <div 
        :class="['task-node-container', isHovered ? 'branch-hover' : '', isPressing ? 'task-pressing' : '']" 
        @mouseenter.stop="onMouseEnter"
        @mouseleave.stop="onMouseLeave"
      >
        <v-list-item
          :value="task.id"
          :ripple="false"
          @click="$root.onTaskRowClick(task, $event)"
          @dblclick="$root.showAddSubtaskForm(task.id)"
          :data-task-id="task.id"
          :class="['task-item', depth > 0 ? 'subtask' : '', task.active_timer_start ? 'timer-active' : '',
                   $root.touchDrag && $root.touchDrag.taskId === task.id ? 'is-dragging' : '',
                   $root.touchDrag && $root.touchDrag.overTaskId === task.id ? 'is-drop-target' : '',
                   $root.touchDrag && $root.touchDrag.taskId !== task.id ? 'is-move-candidate' : '']"
          :style="rowStyle"
          draggable="true"
          @dragstart="$root.handleDragStart(task, $event)"
          @dragover="$root.handleDragOver"
          @dragleave="$root.handleDragLeave"
          @drop.stop="$root.handleDropOnTask(task, $event)"
          @dragend="$root.handleDragEnd"
          @pointerdown="startPress"
          @pointermove="onPressMove"
          @pointerup="onPressEnd"
          @pointercancel="onPressEnd"
        >
          <!-- Radial command popup: replaces the old scrolling list-menu.
               Appears centred on the press point; "Move" starts a pending
               reparent that's completed by tapping the destination task. -->
          <teleport to="body">
            <div v-if="longPressMenu" class="radial-backdrop" @click="closeRadial">
              <div class="radial-menu" :style="{ left: menuX + 'px', top: menuY + 'px' }" @click.stop>
                <button
                  v-for="(item, i) in radialItems"
                  :key="item.key"
                  type="button"
                  class="radial-menu__btn"
                  :class="{ 'is-danger': item.key === 'delete', 'is-on': item.active }"
                  :style="radialBtnStyle(i, radialItems.length)"
                  :title="item.label"
                  @click="onRadialAction(item.key)"
                >
                  <v-icon size="20">{{ item.icon }}</v-icon>
                </button>
                <button type="button" class="radial-menu__center" title="Close" @click="closeRadial">
                  <v-icon size="16">mdi-close</v-icon>
                </button>
              </div>

              <div v-if="radialSubPanel === 'icon'" class="radial-subpanel" :style="{ left: menuX + 'px', top: menuY + 'px' }" @click.stop>
                <button
                  v-for="icon in $root.availableIcons"
                  :key="icon"
                  type="button"
                  class="radial-subpanel__item"
                  :class="{ 'is-on': task.icon === icon }"
                  :title="icon.replace('mdi-', '')"
                  @click="$root.updateTaskIcon(task, icon); closeRadial()"
                >
                  <v-icon size="18">{{ icon }}</v-icon>
                </button>
              </div>

              <div v-if="radialSubPanel === 'color'" class="radial-subpanel" :style="{ left: menuX + 'px', top: menuY + 'px' }" @click.stop>
                <button
                  v-for="color in $root.availableColors"
                  :key="color.value"
                  type="button"
                  class="radial-subpanel__swatch"
                  :style="{ background: color.value }"
                  :title="color.name"
                  @click="$root.updateTaskColor(task, color.value); closeRadial()"
                ></button>
                <button type="button" class="radial-subpanel__item" title="Clear color" @click="$root.updateTaskColor(task, null); closeRadial()">
                  <v-icon size="14">mdi-close</v-icon>
                </button>
              </div>
            </div>
          </teleport>

          <template v-slot:prepend>
            <div class="d-flex align-center toggle-junction gap-2 me-3">
              <v-btn
                v-if="hasChildren"
                icon
                size="x-small"
                variant="text"
                @click.stop="$root.toggleExpand(task.id)"
                class="expand-btn"
              >
                <v-icon size="20">{{ isExpanded ? 'mdi-menu-down' : 'mdi-menu-right' }}</v-icon>
              </v-btn>
              <div v-else style="width: 24px;"></div>
              
              <v-icon 
                size="20" 
                :color="task.done ? 'grey' : (task.color || getPriorityColor(task.importance))"
                class="opacity-70"
              >
                {{ task.icon || (task.status === 'Not Sure' ? 'mdi-help-circle' : 'mdi-checkbox-blank-circle-outline') }}
              </v-icon>
            </div>
          </template>

          <div class="d-flex flex-column flex-grow-1 py-1 ms-1">
            <div class="d-flex align-center gap-golden">
              <v-list-item-title :class="{'text-decoration-line-through opacity-50': task.done}" class="text-wrap font-weight-bold task-name flex-grow-1">
                <span v-if="task.is_focus" class="task-focus-mark" title="On the focus chart">★</span>
                {{ task.name }}
              </v-list-item-title>
              
              <div v-if="task.active_timer_start" class="text-caption font-weight-bold text-error ms-2">
                {{ $root.formatTime($root.getElapsedTime(task.active_timer_start)) }}
              </div>
            </div>

            <v-list-item-subtitle v-if="task.due_date || task.link || task.notes || task.importance || task.urgency || task.leverage_score > 0">
              <div class="d-flex align-center flex-wrap gap-2 mt-1">

                <!-- metadata badges/icons -->
                <v-chip v-if="task.category" size="x-small" color="grey" variant="outlined">{{ task.category }}</v-chip>
                <span v-if="task.due_date" class="text-xxs text-orange">
                  <v-icon size="10">mdi-calendar</v-icon> {{ task.due_date }}
                </span>
                <a v-if="task.link" href="javascript:void(0)" @click.stop="$root.startWorkOnTask(task)" class="text-decoration-none">
                  <v-icon size="10" color="primary" title="Start work and open link">mdi-link-variant</v-icon>
                </a>
                <v-icon v-if="task.notes" size="10" color="grey">mdi-note-text-outline</v-icon>
              </div>
            </v-list-item-subtitle>
          </div>

          <template v-slot:append>
            <div class="d-flex align-center gap-2">
              <v-checkbox 
                :model-value="task.done" 
                @change="$root.toggleTaskDone(task)"
                color="primary"
                hide-details
                @click.stop
                class="task-checkbox"
              ></v-checkbox>
            </div>
          </template>
        </v-list-item>

        <div v-if="hasChildren && isExpanded" class="subtasks-wrapper">
          <task-node
            v-for="child in children"
            :key="child.id"
            :task="child"
            :depth="depth + 1"
            :tasks="tasks"
            :expanded-tasks="expandedTasks"
            :show-completed-subtasks="showCompletedSubtasks"
          ></task-node>
        </div>
      </div>
    `,
    computed: {
      children() {
        const filtered = this.tasks.filter(t => Number(t.parent_id) === Number(this.task.id) && (!t.done || this.showCompletedSubtasks));
        return this.$root.sortTasks(filtered);
      },
      hasChildren() { return this.children.length > 0; },
      isExpanded() { return this.expandedTasks.has(this.task.id); },
      isHovered() {
        return this.$root.hoveredTaskId === this.task.id || this.$root.hoveredTaskAncestors.has(this.task.id);
      },
      rowStyle() {
        const style = { cursor: 'grab', position: 'relative' };
        if (this.task.color) {
          style.backgroundColor = this.task.color + '15';
          style.borderLeft = '4px solid ' + this.task.color;
        }
        const drag = this.$root.touchDrag;
        if (drag && drag.taskId === this.task.id) {
          // Being moved: fade it, don't darken it — no shadow/scale, just
          // low opacity so it still reads as itself.
          style.opacity = 0.45;
          if (drag.mode === 'drag') {
            style.transform = `translate(${drag.curX - drag.startX}px, ${drag.curY - drag.startY}px)`;
            style.zIndex = 50;
          }
        }
        return style;
      },
      // Icon-only radial popup, replacing the old scrolling list-menu.
      // "Move" starts a pending reparent (see beginPendingMove) instead of
      // the old positional Move In/Out — pick the exact destination task by
      // tapping it, no ambiguity about what's "above" it in the sort order.
      radialItems() {
        const t = this.task;
        return [
          { key: 'icon', icon: t.icon || 'mdi-circle-outline', label: 'Icon' },
          { key: 'color', icon: 'mdi-palette', label: 'Color' },
          { key: 'move', icon: 'mdi-cursor-move', label: 'Move to another task' },
          { key: 'addSubtask', icon: 'mdi-plus', label: 'Add Subtask' },
          { key: 'edit', icon: 'mdi-pencil', label: 'Edit Details' },
          { key: 'notes', icon: 'mdi-note-edit', label: 'Notes' },
          { key: 'timer', icon: t.active_timer_start ? 'mdi-stop-circle' : 'mdi-play-circle', label: t.active_timer_start ? 'Stop Timer' : 'Start Timer' },
          { key: 'notSure', icon: 'mdi-help-circle', label: 'Not Sure', active: t.status === 'Not Sure' },
          { key: 'focus', icon: t.is_focus ? 'mdi-star' : 'mdi-star-outline', label: t.is_focus ? 'Remove from focus chart' : 'Add to focus chart', active: !!t.is_focus },
          { key: 'copyTree', icon: 'mdi-content-copy', label: 'Copy hierarchy (for AI)' },
          { key: 'delete', icon: 'mdi-delete', label: 'Delete' }
        ];
      }
    },
    methods: {
      onMouseEnter() { this.$root.hoveredTaskId = this.task.id; },
      onMouseLeave() { this.$root.hoveredTaskId = null; },
      getPriorityColor(value) {
        if (value >= 8) return 'error';
        if (value >= 6) return 'warning';
        if (value >= 4) return 'info';
        return 'success';
      },
      startPress(e) {
        // Only trigger on left click
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        this.isPressing = true;
        this._gestureStartX = e.clientX;
        this._gestureStartY = e.clientY;
        this._gesturePointerId = e.pointerId;
        this._gesturePointerType = e.pointerType;
        this._dragStarted = false;
        this.longPressTimer = setTimeout(() => {
          this.showModeMenu(e);
        }, 500); // 0.5 seconds
      },
      endPress() {
        this.isPressing = false;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      },
      // Touch-only: swipe a row sideways past a small threshold to "detach"
      // it into reparent-drag mode (mouse keeps using native draggable="true"
      // drag-and-drop instead — see the dragstart/dragover/drop handlers).
      onPressMove(e) {
        if (this._gestureStartX == null) return;
        const root = this.$root;

        if (root.touchDrag && root.touchDrag.mode === 'drag' && root.touchDrag.taskId === this.task.id) {
          e.preventDefault();
          root.touchDrag.curX = e.clientX;
          root.touchDrag.curY = e.clientY;
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const rowEl = el && el.closest ? el.closest('.task-item') : null;
          const overId = rowEl && rowEl.dataset.taskId ? Number(rowEl.dataset.taskId) : null;
          root.touchDrag.overTaskId = (overId && overId !== this.task.id) ? overId : null;
          return;
        }

        if (this._dragStarted || root.touchDrag) return;
        const dx = e.clientX - this._gestureStartX;
        const dy = e.clientY - this._gestureStartY;

        // Any real movement means this press is turning into a scroll (or
        // some other gesture), not a hold-in-place — cancel the pending
        // long-press timer so it can't pop the radial menu open mid-scroll.
        // A native touch-scroll leaves the pointer "down" for its whole
        // duration, so waiting for pointerup/pointercancel alone isn't
        // reliable enough to stop the timer in time.
        if (this.longPressTimer && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          this.endPress();
        }

        if (this._gesturePointerType !== 'touch') return;
        if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          this._dragStarted = true;
          this.endPress();
          root.touchDrag = {
            mode: 'drag',
            taskId: this.task.id,
            taskName: this.task.name,
            startX: this._gestureStartX,
            startY: this._gestureStartY,
            curX: e.clientX,
            curY: e.clientY,
            overTaskId: null
          };
          try { e.target.setPointerCapture(this._gesturePointerId); } catch (err) {}
        }
      },
      onPressEnd(e) {
        this.endPress();
        const root = this.$root;
        if (root.touchDrag && root.touchDrag.mode === 'drag' && root.touchDrag.taskId === this.task.id) {
          const overId = root.touchDrag.overTaskId;
          root.touchDrag = null;
          if (overId) {
            const targetTask = root.tasks.find(t => t.id === overId);
            if (targetTask) root.touchReparentTask(this.task.id, targetTask);
          }
        }
        this._gestureStartX = null;
        this._dragStarted = false;
      },
      radialBtnStyle(i, n) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const radius = 84;
        return { transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)` };
      },
      onRadialAction(key) {
        const root = this.$root;
        switch (key) {
          case 'icon': this.radialSubPanel = 'icon'; return;
          case 'color': this.radialSubPanel = 'color'; return;
          case 'move': this.beginPendingMove(); return;
          case 'notSure': root.toggleNotSure(this.task); break;
          case 'focus': root.toggleTaskFocus(this.task); break;
          case 'timer': root.toggleTimer(this.task); break;
          case 'addSubtask': root.showAddSubtaskForm(this.task.id); break;
          case 'edit': (this.depth === 0 ? root.editTask(this.task) : root.editSubtask(this.task)); break;
          case 'notes': root.editTaskNotes(this.task); break;
          case 'copyTree': root.copyTaskHierarchy(this.task); break;
          case 'delete': root.deleteTask(this.task.id, this.task.name); break;
        }
        this.closeRadial();
      },
      closeRadial() {
        this.longPressMenu = false;
        this.radialSubPanel = null;
      },
      // "Move" from the radial menu is a tap-to-select destination, not a
      // live drag — the press that opened the menu is already over by the
      // time you tap this button, so there's no finger left to track. Every
      // other task row becomes a tap target (see $root.onTaskRowClick) until
      // you tap one, or tap this task again to cancel.
      beginPendingMove() {
        this.closeRadial();
        this.$root.touchDrag = {
          mode: 'pending',
          taskId: this.task.id,
          taskName: this.task.name,
          overTaskId: null
        };
        this.$root.showNotification(`Tap a task to move "${this.task.name}" under it (tap it again to cancel)`, 'info');
      },
      showModeMenu(e) {
        this.isPressing = false;
        
        // Handle both mouse and touch events
        const event = e.touches ? e.touches[0] : e;
        this.menuX = event.clientX;
        this.menuY = event.clientY;
        
        this.longPressMenu = true;
        
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }
  });

  // Mount Vuetify to the app
  app.use(vuetify);
  
  // Mount the app to the DOM
  app.mount('#app');
  
  // window.app is already set in the mounted() hook above
});

// Now these exports will be valid since the variables are defined at the top level
export {
  chartVisualization,
  taskOperations,
  taskListManager
}; 
