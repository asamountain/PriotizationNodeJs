export class ChartVisualization {
  constructor() {
    this.chartGroup = null;
    this.dotsGroup = null;
    this.chartWidth = 800;
    this.chartHeight = 600;
    this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    this.tooltipElement = null;
    this.vuetifyColors = {
      primary: '#1976D2',
      secondary: '#9C27B0',
      accent: '#FF4081',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
      success: '#4CAF50',
    };
  }
  
  initializeChart() {
    console.log('Initializing Vuetify style chart');
    
    // Make sure there are no errors from previous initialization attempts
    try {
      const container = document.getElementById('taskChart');
      if (!container) {
        console.error('No chart container found!');
        return;
      }
      
      // Clear container
      container.innerHTML = '';
      
      // Create SVG with clean design
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 800 600');
      svg.style.display = 'block';
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.zIndex = '10';
      
      // Create definitions for filters and patterns
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      
      // Create the elevation shadow filter (Vuetify-style)
      const elevationShadow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      elevationShadow.setAttribute('id', 'elevation-2');
      elevationShadow.setAttribute('x', '-50%');
      elevationShadow.setAttribute('y', '-50%');
      elevationShadow.setAttribute('width', '200%');
      elevationShadow.setAttribute('height', '200%');
      
      // Vuetify-style soft shadow
      const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      feDropShadow.setAttribute('dx', '0');
      feDropShadow.setAttribute('dy', '2');
      feDropShadow.setAttribute('stdDeviation', '2');
      feDropShadow.setAttribute('flood-opacity', '0.2');
      feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.5)');
      elevationShadow.appendChild(feDropShadow);
      
      defs.appendChild(elevationShadow);
      
      // Create ripple effect filter
      const rippleFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      rippleFilter.setAttribute('id', 'ripple-effect');
      rippleFilter.setAttribute('x', '-50%');
      rippleFilter.setAttribute('y', '-50%');
      rippleFilter.setAttribute('width', '200%');
      rippleFilter.setAttribute('height', '200%');
      
      const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      feGaussianBlur.setAttribute('in', 'SourceGraphic');
      feGaussianBlur.setAttribute('stdDeviation', '1');
      feGaussianBlur.setAttribute('result', 'blur');
      rippleFilter.appendChild(feGaussianBlur);
      
      defs.appendChild(rippleFilter);
      
      svg.appendChild(defs);
      
      // Create clean background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('x', '0');
      background.setAttribute('y', '0');
      background.setAttribute('width', '800');
      background.setAttribute('height', '600');
      background.setAttribute('fill', 'var(--v-background, #ffffff)');
      background.setAttribute('rx', '4');
      background.setAttribute('ry', '4');
      svg.appendChild(background);
      
      // Create dots group for task nodes
      const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      dotsGroup.classList.add('task-nodes');
      svg.appendChild(dotsGroup);
      
      // Add subtle border
      const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      border.setAttribute('x', '2');
      border.setAttribute('y', '2');
      border.setAttribute('width', '796');
      border.setAttribute('height', '596');
      border.setAttribute('fill', 'none');
      border.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
      border.setAttribute('stroke-width', '1');
      border.setAttribute('rx', '4');
      border.setAttribute('ry', '4');
      svg.appendChild(border);
      
      // Add quadrants
      const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gridGroup.classList.add('grid-lines');
      
      // Add the four quadrants with labels
      this.addVuetifyQuadrants(gridGroup);
      
      svg.appendChild(gridGroup);
      
      // Store SVG and group for later use
      this.chartGroup = svg;
      this.dotsGroup = dotsGroup;
      container.appendChild(svg);
      
      // Request tasks to render immediately
      this.getTasks().then(tasks => {
        if (tasks && tasks.length > 0) {
          console.log(`Rendering ${tasks.length} tasks immediately`);
          this.renderChart(tasks);
        }
      }).catch(err => console.error('Error getting tasks:', err));
      
      return this;
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }
  
  getTasks() {
    return new Promise((resolve) => {
      // Try to get tasks from Vue app
      if (window.app && Array.isArray(window.app.tasks) && window.app.tasks.length > 0) {
        console.log('Using tasks from Vue app:', window.app.tasks.length);
        return resolve(window.app.tasks);
      }
      
      // Try taskManager
      if (window.taskManager && Array.isArray(window.taskManager.tasks) && window.taskManager.tasks.length > 0) {
        console.log('Using tasks from taskManager:', window.taskManager.tasks.length);
        return resolve(window.taskManager.tasks);
      }
      
      // No tasks found in memory, wait for socket update
      console.log('No tasks found in memory, waiting for socket update');
      
      // Try to request data directly
      const socket = window.app?.socket || window.taskManager?.socket || io(window.location.origin);
      socket.emit('requestInitialData');
      
      // Set up a one-time listener for the data
      const listener = (data) => {
        if (data && data.data && Array.isArray(data.data)) {
          console.log('Got tasks via socket listener:', data.data.length);
          resolve(data.data);
        } else {
          console.warn('Received invalid data format:', data);
          resolve([]);
        }
      };
      
      socket.once('initialData', listener);
      
      // Fallback timeout
      setTimeout(() => {
        socket.off('initialData', listener);
        console.warn('Timed out waiting for tasks, returning empty array');
        resolve([]);
      }, 3000);
    });
  }
  
  addVuetifyQuadrants(parentGroup) {
    // Create quadrant backgrounds with Vuetify color scheme
    
    // Quadrant 1: Important & Urgent (top-right) - Error color
    const q1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    q1.setAttribute('x', '400');
    q1.setAttribute('y', '40');
    q1.setAttribute('width', '360');
    q1.setAttribute('height', '260');
    q1.setAttribute('fill', this.vuetifyColors.error);
    q1.setAttribute('opacity', '0.05');
    q1.setAttribute('rx', '2');
    q1.setAttribute('ry', '2');
    parentGroup.appendChild(q1);
    
    // Quadrant 2: Important & Not Urgent (bottom-right) - Success color
    const q2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    q2.setAttribute('x', '400');
    q2.setAttribute('y', '300');
    q2.setAttribute('width', '360');
    q2.setAttribute('height', '260');
    q2.setAttribute('fill', this.vuetifyColors.success);
    q2.setAttribute('opacity', '0.05');
    q2.setAttribute('rx', '2');
    q2.setAttribute('ry', '2');
    parentGroup.appendChild(q2);
    
    // Quadrant 3: Not Important & Urgent (top-left) - Warning color
    const q3 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    q3.setAttribute('x', '40');
    q3.setAttribute('y', '40');
    q3.setAttribute('width', '360');
    q3.setAttribute('height', '260');
    q3.setAttribute('fill', this.vuetifyColors.warning);
    q3.setAttribute('opacity', '0.05');
    q3.setAttribute('rx', '2');
    q3.setAttribute('ry', '2');
    parentGroup.appendChild(q3);
    
    // Quadrant 4: Not Important & Not Urgent (bottom-left) - Info color
    const q4 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    q4.setAttribute('x', '40');
    q4.setAttribute('y', '300');
    q4.setAttribute('width', '360');
    q4.setAttribute('height', '260');
    q4.setAttribute('fill', this.vuetifyColors.info);
    q4.setAttribute('opacity', '0.05');
    q4.setAttribute('rx', '2');
    q4.setAttribute('ry', '2');
    parentGroup.appendChild(q4);
    
    // Add quadrant labels in Vuetify style
    this.addVuetifyQuadrantLabels(parentGroup);
    
    // Add axes lines
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '40');
    xAxis.setAttribute('y1', '300');
    xAxis.setAttribute('x2', '760');
    xAxis.setAttribute('y2', '300');
    xAxis.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
    xAxis.setAttribute('stroke-width', '2');
    parentGroup.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '400');
    yAxis.setAttribute('y1', '40');
    yAxis.setAttribute('x2', '400');
    yAxis.setAttribute('y2', '560');
    yAxis.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
    yAxis.setAttribute('stroke-width', '2');
    parentGroup.appendChild(yAxis);
    
    // Add axis labels in Vuetify typography style
    const importanceLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    importanceLabel.setAttribute('x', '400');
    importanceLabel.setAttribute('y', '580');
    importanceLabel.setAttribute('text-anchor', 'middle');
    importanceLabel.setAttribute('font-family', 'Roboto, sans-serif');
    importanceLabel.setAttribute('font-size', '14px');
    importanceLabel.setAttribute('font-weight', '500');
    importanceLabel.setAttribute('fill', 'var(--v-text-primary, rgba(0,0,0,0.87))');
    importanceLabel.textContent = 'IMPORTANCE';
    parentGroup.appendChild(importanceLabel);
    
    const urgencyLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    urgencyLabel.setAttribute('transform', 'rotate(-90)');
    urgencyLabel.setAttribute('x', '-300');
    urgencyLabel.setAttribute('y', '20');
    urgencyLabel.setAttribute('text-anchor', 'middle');
    urgencyLabel.setAttribute('font-family', 'Roboto, sans-serif');
    urgencyLabel.setAttribute('font-size', '14px');
    urgencyLabel.setAttribute('font-weight', '500');
    urgencyLabel.setAttribute('fill', 'var(--v-text-primary, rgba(0,0,0,0.87))');
    urgencyLabel.textContent = 'URGENCY';
    parentGroup.appendChild(urgencyLabel);
  }
  
  addVuetifyQuadrantLabels(parentGroup) {
    // Q1: Important & Urgent
    this.createVuetifyChip(
      parentGroup, 
      730, 
      60, 
      'Important & Urgent', 
      this.vuetifyColors.error
    );
    
    // Q2: Important & Not Urgent
    this.createVuetifyChip(
      parentGroup, 
      730, 
      320, 
      'Important & Not Urgent', 
      this.vuetifyColors.success
    );
    
    // Q3: Not Important & Urgent
    this.createVuetifyChip(
      parentGroup, 
      70, 
      60, 
      'Not Important & Urgent', 
      this.vuetifyColors.warning
    );
    
    // Q4: Not Important & Not Urgent
    this.createVuetifyChip(
      parentGroup, 
      70, 
      320, 
      'Not Important & Not Urgent', 
      this.vuetifyColors.info
    );
  }
  
  createVuetifyChip(parentGroup, x, y, label, color) {
    const chipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chipGroup.classList.add('vuetify-chip');
    
    // Chip background
    const chipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    chipBg.setAttribute('x', x - 60);
    chipBg.setAttribute('y', y - 12);
    chipBg.setAttribute('width', '120');
    chipBg.setAttribute('height', '24');
    chipBg.setAttribute('rx', '12');
    chipBg.setAttribute('ry', '12');
    chipBg.setAttribute('fill', color);
    chipBg.setAttribute('opacity', '0.1');
    chipBg.setAttribute('stroke', color);
    chipBg.setAttribute('stroke-width', '1');
    chipGroup.appendChild(chipBg);
    
    // Chip text
    const chipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    chipText.setAttribute('x', x);
    chipText.setAttribute('y', y + 4);
    chipText.setAttribute('text-anchor', 'middle');
    chipText.setAttribute('font-family', 'Roboto, sans-serif');
    chipText.setAttribute('font-size', '10px');
    chipText.setAttribute('font-weight', '500');
    chipText.setAttribute('fill', color);
    chipText.textContent = label;
    chipGroup.appendChild(chipText);
    
    parentGroup.appendChild(chipGroup);
  }
  
  renderChart(tasks) {
    console.log('Rendering Vuetify style chart');
    
    if (!this.dotsGroup) {
      console.error('No dots group available for rendering!');
      return;
    }
    
    // Clear existing dots
    this.dotsGroup.innerHTML = '';
    
    // Filter for active parent tasks only
    const parentTasks = tasks ? tasks.filter(task => !task.done && !task.parent_id) : [];
    
    // If no tasks, show empty state
    if (!parentTasks || parentTasks.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    console.log(`Found ${parentTasks.length} active tasks to render`);
    
    // Calculate quadrant stats (if Vue app exists, update there too)
    this.calculateQuadrantStats(parentTasks);
    
    // Render each task as a dot
    parentTasks.forEach(task => {
      const position = this.calculateTaskPosition(task);
      const dot = this.createTaskDot(task, position.x, position.y);
      this.dotsGroup.appendChild(dot);
      console.log(`Added dot for task ${task.id} at position ${position.x},${position.y}`);
    });
    
    console.log(`Successfully added ${parentTasks.length} task dots to the chart`);
  }
  
  renderEmptyState() {
    // Create empty state message
    const emptyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    textBg.setAttribute('x', '250');
    textBg.setAttribute('y', '280');
    textBg.setAttribute('width', '300');
    textBg.setAttribute('height', '40');
    textBg.setAttribute('rx', '20');
    textBg.setAttribute('ry', '20');
    textBg.setAttribute('fill', '#f5f5f5');
    emptyGroup.appendChild(textBg);
    
    const emptyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emptyText.setAttribute('x', '400');
    emptyText.setAttribute('y', '305');
    emptyText.setAttribute('text-anchor', 'middle');
    emptyText.setAttribute('font-family', 'Roboto, sans-serif');
    emptyText.setAttribute('font-size', '16px');
    emptyText.setAttribute('fill', '#757575');
    emptyText.textContent = 'No active tasks to display';
    emptyGroup.appendChild(emptyText);
    
    this.dotsGroup.appendChild(emptyGroup);
  }
  
  calculateTaskPosition(task) {
    // Set default values if missing
    const importance = task.importance !== undefined ? Number(task.importance) : 5;
    const urgency = task.urgency !== undefined ? Number(task.urgency) : 5;
    
    // Calculate position - map 0-10 scale to chart coordinates
    // Importance on x-axis (40 to 760), Urgency on y-axis (40 to 560, inverted)
    const x = 40 + (importance / 10) * 720;
    const y = 560 - (urgency / 10) * 520;
    
    return { x, y };
  }
  
  createTaskDot(task, x, y) {
    const dotGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotGroup.classList.add('task-dot-group');
    dotGroup.setAttribute('data-task-id', task.id);
    
    // Determine color based on quadrant
    const color = this.getQuadrantColorForTask(task);
    
    // Create the task dot with proper styling
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', '12');
    dot.setAttribute('fill', color);
    dot.setAttribute('class', 'task-dot');
    dot.setAttribute('data-task-id', task.id);
    dot.style.cursor = 'pointer';
    dot.style.transition = 'all 0.2s ease';
    
    // Add shadow for elevation
    dot.setAttribute('filter', 'url(#elevation-2)');
    
    // Add event listeners
    dot.addEventListener('click', () => this.focusOnTask(task.id));
    dot.addEventListener('mouseenter', () => this.handleDotHover(dot, task));
    dot.addEventListener('mouseleave', () => this.handleDotLeave(dot));
    
    dotGroup.appendChild(dot);
    
    // Add a text label below the dot for very important tasks
    if (task.importance > 7 || task.urgency > 7) {
      const taskName = task.name.length > 15 ? task.name.substring(0, 12) + '...' : task.name;
      
      // Add background for text
      const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      textBg.setAttribute('x', x - 50);
      textBg.setAttribute('y', y + 15);
      textBg.setAttribute('width', '100');
      textBg.setAttribute('height', '20');
      textBg.setAttribute('rx', '10');
      textBg.setAttribute('ry', '10');
      textBg.setAttribute('fill', 'white');
      textBg.setAttribute('opacity', '0.8');
      textBg.setAttribute('stroke', color);
      textBg.setAttribute('stroke-width', '1');
      dotGroup.appendChild(textBg);
      
      // Add text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 29);
      text.setAttribute('font-family', 'Roboto, sans-serif');
      text.setAttribute('font-size', '10px');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#333');
      text.textContent = taskName;
      dotGroup.appendChild(text);
    }
    
    return dotGroup;
  }
  
  handleDotHover(dot, task) {
    // Enlarge dot on hover
    dot.setAttribute('r', '15');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '2');
    
    // Show tooltip with task details
    const content = this.createTooltipContent(task);
    this.showTooltip(content, dot);
  }
  
  handleDotLeave(dot) {
    // Restore original size on mouse leave
    dot.setAttribute('r', '12');
    dot.setAttribute('stroke', 'none');
    dot.setAttribute('stroke-width', '0');
    
    // Hide tooltip
    this.hideTooltip();
  }
  
  createTooltipContent(task) {
    // Get subtasks if available
    const subtasks = [];
    if (window.taskManager && window.taskManager.tasks) {
      const allTasks = window.taskManager.tasks;
      subtasks.push(...allTasks.filter(t => t.parent_id === task.id));
    } else if (window.app && window.app.tasks) {
      const allTasks = window.app.tasks;
      subtasks.push(...allTasks.filter(t => t.parent_id === task.id));
    }
    
    // Format completion count
    const completedSubtasks = subtasks.filter(s => s.done).length;
    
    // Create tooltip content with Vuetify styling
    return `
      <div style="font-family: Roboto, sans-serif; width: 250px; border-radius: 4px; overflow: hidden; box-shadow: 0 3px 6px rgba(0,0,0,0.16);">
        <div style="background-color: ${this.getQuadrantColorForTask(task)}; color: white; padding: 12px 16px;">
          <div style="font-weight: 500; font-size: 16px;">${task.name}</div>
        </div>
        <div style="background: white; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div>Importance: <b>${task.importance}/10</b></div>
            <div>Urgency: <b>${task.urgency}/10</b></div>
          </div>
          ${task.link ? `<div style="margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis;">
            <a href="${task.link}" target="_blank" style="color: #1976D2; text-decoration: none;">
              ${task.link}
            </a>
          </div>` : ''}
          ${task.due_date ? `<div style="margin-bottom: 8px;">
            Due: <b>${new Date(task.due_date).toLocaleDateString()}</b>
          </div>` : ''}
          ${subtasks.length > 0 ? `
            <div style="margin-top: 12px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 8px;">
                Subtasks: ${completedSubtasks}/${subtasks.length}
              </div>
              <ul style="margin: 0; padding-left: 20px;">
                ${subtasks.slice(0, 3).map(s => `
                  <li style="${s.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    ${s.name}
                  </li>
                `).join('')}
                ${subtasks.length > 3 ? `<li style="opacity: 0.6; list-style: none;">+ ${subtasks.length - 3} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
          <div style="margin-top: 12px; font-size: 12px; color: #757575; text-align: center;">
            Click to focus on this task
          </div>
        </div>
      </div>
    `;
  }
  
  showTooltip(content, element) {
    // Remove any existing tooltips
    this.hideTooltip();
    
    // Create tooltip container if it doesn't exist
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'chart-tooltip';
      this.tooltipElement.style.position = 'absolute';
      this.tooltipElement.style.zIndex = '9999';
      this.tooltipElement.style.pointerEvents = 'none';
      this.tooltipElement.style.transition = 'opacity 0.2s ease';
      this.tooltipElement.style.opacity = '0';
      document.body.appendChild(this.tooltipElement);
    }
    
    // Update content
    this.tooltipElement.innerHTML = content;
    
    // Get element position
    const rect = element.getBoundingClientRect();
    
    // Position the tooltip
    this.tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltipElement.style.top = `${rect.top - 10}px`;
    this.tooltipElement.style.transform = 'translate(-50%, -100%)';
    
    // Make tooltip visible
    setTimeout(() => {
      this.tooltipElement.style.opacity = '1';
    }, 10);
  }
  
  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = '0';
    }
  }
  
  calculateQuadrantStats(tasks) {
    // Reset stats
    this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    
    // Process tasks
    tasks.forEach(task => {
      const quadrant = this.getQuadrantForTask(task);
      this.quadrantStats[quadrant]++;
    });
    
    // Update Vue app if available
    if (window.app && window.app.quadrantStats) {
      window.app.quadrantStats = { ...this.quadrantStats };
    }
    
    return this.quadrantStats;
  }
  
  getQuadrantForTask(task) {
    const isImportant = task.importance > 5;
    const isUrgent = task.urgency > 5;
    
    if (isImportant && isUrgent) return 'q1';
    if (isImportant && !isUrgent) return 'q2';
    if (!isImportant && isUrgent) return 'q3';
    return 'q4';
  }
  
  getQuadrantColorForTask(task) {
    const quadrant = this.getQuadrantForTask(task);
    switch (quadrant) {
      case 'q1':
        return this.vuetifyColors.error;
      case 'q2':
        return this.vuetifyColors.success;
      case 'q3':
        return this.vuetifyColors.warning;
      case 'q4':
        return this.vuetifyColors.info;
      default:
        throw new Error('Invalid quadrant');
    }
  }
  
  focusOnTask(taskId) {
    console.log(`Focusing on task ${taskId}`);
    
    if (!this.dotsGroup) {
      console.warn('Chart not initialized, cannot focus on task');
      return;
    }
    
    // Find the task dot in the SVG
    const taskDot = this.dotsGroup.querySelector(`.task-dot[data-task-id="${taskId}"]`);
    if (!taskDot) {
      console.warn(`No dot found for task ${taskId}`);
      return;
    }
    
    // Remove highlight from all dots
    this.dotsGroup.querySelectorAll('.task-dot').forEach(dot => {
      dot.classList.remove('selected-dot');
      dot.setAttribute('r', '12'); // Reset to normal size
      dot.setAttribute('stroke', 'none');
    });
    
    // Highlight the selected dot
    taskDot.classList.add('selected-dot');
    taskDot.setAttribute('r', '18'); // Make it bigger
    taskDot.setAttribute('stroke', '#ffffff');
    taskDot.setAttribute('stroke-width', '3');
    
    // Create a pulse animation
    const animateEl = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateEl.setAttribute('attributeName', 'r');
    animateEl.setAttribute('from', '18');
    animateEl.setAttribute('to', '22');
    animateEl.setAttribute('dur', '1s');
    animateEl.setAttribute('repeatCount', '3');
    taskDot.appendChild(animateEl);
    animateEl.beginElement();
    
    // Also highlight in the task list
    const taskListItem = document.querySelector(`.task[data-task-id="${taskId}"]`);
    if (taskListItem) {
      taskListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add a highlight class
      taskListItem.classList.add('highlighted-task');
      
      // Remove the highlight after 3 seconds
      setTimeout(() => {
        taskListItem.classList.remove('highlighted-task');
      }, 3000);
    }
  }
  
  updateChartColors() {
    console.log('Updating chart colors based on theme');
    
    // Check if the chart is initialized
    if (!this.chartGroup) {
      console.warn('Chart not initialized yet, cannot update colors');
      return;
    }
    
    // Determine if dark theme is active
    const isDarkTheme = document.body.classList.contains('dark-theme') || 
                       localStorage.getItem('isDarkTheme') === 'true';
    
    // Update background color
    const background = this.chartGroup.querySelector('rect:first-child');
    if (background) {
      background.setAttribute('fill', isDarkTheme ? '#121212' : '#ffffff');
    }
    
    // Update text colors
    const textElements = this.chartGroup.querySelectorAll('text');
    textElements.forEach(text => {
      if (!text.hasAttribute('data-color-locked')) {
        text.setAttribute('fill', isDarkTheme ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)');
      }
    });
    
    // If tasks are available, re-render to apply new colors
    this.getTasks().then(tasks => {
      if (tasks && tasks.length > 0) {
        this.renderChart(tasks);
      }
    }).catch(err => console.error('Error getting tasks for color update:', err));
  }
} 