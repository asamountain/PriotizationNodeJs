export class TaskManager {
  constructor() {
    try {
      // Use the global io object from Socket.IO client
      if (typeof io === 'undefined') {
        throw new Error('Socket.IO not loaded');
      }
      this.socket = io(window.location.origin);
      
      this.taskList = document.querySelector('#task-list');
      this.taskForm = document.querySelector('#task-form');
      
      // Initialize tasks array - THIS FIXES ISSUE #2
      this.tasks = [];
      
      // Add a callback property for Vue integration
      this.onTasksUpdate = null;
      this.vueApp = null;
      
      // Set theme based on document body class or localStorage
      this.isDarkTheme = document.body.classList.contains('dark-theme') || 
                          localStorage.getItem('isDarkTheme') === 'true';
      
      this.initializeSocket();
      this.initializeChart();
      this.initializeForm();
      
      // Add resize listener for responsive chart
      window.addEventListener('resize', this.handleResize.bind(this));
      
      // Add this line to make taskManager globally accessible for event handlers
      window.taskManager = this;
    } catch (error) {
      console.error('TaskManager constructor error:', error);
    }
  }

  // Set reference to Vue app for theme changes
  setVueApp(app) {
    this.vueApp = app;
    
    // Watch for theme changes
    if (app) {
      // Create a method to update theme when it changes in Vue
      const updateTheme = () => {
        this.isDarkTheme = app.isDarkTheme || document.body.classList.contains('dark-theme');
        this.updateChartColors();
      };
      
      // Check if we can watch for theme changes
      if (app.$watch) {
        app.$watch('isDarkTheme', updateTheme);
      } else {
        // Fallback for Vue 3
        setTimeout(updateTheme, 100); // Initial update
        
        // Listen for theme toggle events
        window.addEventListener('themeChanged', updateTheme);
      }
    }
  }

  // Update chart colors based on current theme
  updateChartColors() {
    if (!this.chartGroup) {
      console.log("Chart not initialized yet, can't update colors");
      return;
    }

    console.log("Updating chart colors for theme change");
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;
    
    // Get the main SVG element (parent of chartGroup)
    const svg = this.chartGroup.parentNode;
    if (!svg) return;
    
    // Update X and Y axes
    const axes = this.chartGroup.querySelectorAll('line');
    axes.forEach(axis => {
      axis.setAttribute('stroke', isDark ? '#777' : '#999');
    });
    
    // Update axis labels
    const labels = this.chartGroup.querySelectorAll('text');
    labels.forEach(label => {
      label.setAttribute('fill', isDark ? '#DDD' : '#333');
    });
    
    // Update quadrant lines
    const quadrantLines = this.chartGroup.querySelectorAll('line[stroke-dasharray]');
    quadrantLines.forEach(line => {
      line.setAttribute('stroke', isDark ? '#555' : '#ccc');
    });
    
    // Update task dots
    const dots = this.chartGroup.querySelectorAll('circle.task-dot');
    dots.forEach(dot => {
      const taskId = dot.getAttribute('data-task-id');
      const task = this.tasks.find(t => t.id === parseInt(taskId));
      if (task) {
        dot.setAttribute('fill', this.getQuadrantColorForTask(task));
        dot.setAttribute('stroke', isDark ? '#444' : '#fff');
      }
    });
    
    // Force a re-render of the chart
    if (this.tasks && Array.isArray(this.tasks)) {
      this.renderChart(this.tasks);
    }
  }

  // Handle window resize
  handleResize() {
    // Debounce resize events
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      // Re-initialize chart with new dimensions
      this.initializeChart();
      // Re-render data if available
      if (this._lastData) {
        this.renderChart(this._lastData);
      }
    }, 250);
  }

  initializeSocket() {
    this.socket.on('connect', () => {
      this.socket.emit('requestInitialData');
    });

    this.socket.on('initialData', (data) => {
      this.handleData(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('Server error:', error);
    });

    this.socket.on('taskAdded', (response) => {
      console.log('Task added:', response);
    });

    this.socket.on('updateTasks', (data) => {
      this.handleData(data);
    });
  }

  initializeForm() {
    if (this.taskForm) {
      this.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addTask();
      });
    }
  }

  initializeChart() {
    console.log('--- NEW SIMPLE CHART INITIALIZATION ---');
    
    // Get the container
    const container = document.getElementById('taskChart');
    if (!container) {
      console.error('No chart container found!');
      return;
    }
    
    // Clear the container
    container.innerHTML = '';
    
    // Create a simple SVG directly with no complexity
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 800 600');
    svg.style.display = 'block';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.zIndex = '10';
    
    // Create a container group for all the dots
    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.classList.add('task-dots');
    dotsGroup.setAttribute('transform', 'translate(50, 50)');
    svg.appendChild(dotsGroup);
    
    // Add a visible border to the chart area
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', '50');
    border.setAttribute('y', '50');
    border.setAttribute('width', '700');
    border.setAttribute('height', '500');
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', 'red');
    border.setAttribute('stroke-width', '3');
    svg.appendChild(border);
    
    // Create coordinate axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '50');
    xAxis.setAttribute('y1', '300');
    xAxis.setAttribute('x2', '750');
    xAxis.setAttribute('y2', '300');
    xAxis.setAttribute('stroke', 'black');
    xAxis.setAttribute('stroke-width', '2');
    svg.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '400');
    yAxis.setAttribute('y1', '50');
    yAxis.setAttribute('x2', '400');
    yAxis.setAttribute('y2', '550');
    yAxis.setAttribute('stroke', 'black');
    yAxis.setAttribute('stroke-width', '2');
    svg.appendChild(yAxis);
    
    // Add a static test dot that will definitely be visible
    const testDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    testDot.setAttribute('cx', '400');
    testDot.setAttribute('cy', '300');
    testDot.setAttribute('r', '20');
    testDot.setAttribute('fill', 'purple');
    testDot.setAttribute('stroke', 'black');
    testDot.setAttribute('stroke-width', '2');
    dotsGroup.appendChild(testDot);
    
    // Store chart dimensions
    this.chartWidth = 700;
    this.chartHeight = 500;
    
    // Store the SVG and dots group for later use
    this.chartGroup = dotsGroup;
    this.dotsGroup = dotsGroup;
    container.appendChild(svg);
    
    console.log('Simple chart initialized with test dot');
    
    // If we have tasks, render them after a short delay
    setTimeout(() => {
      if (this.tasks && this.tasks.length > 0) {
        console.log(`Rendering ${this.tasks.length} tasks after delay`);
        this.renderChart(this.tasks);
      }
    }, 500);
    
    return this;
  }
  
  initializeCompletionChart() {
    console.log('TaskManager.initializeCompletionChart called');
    
    // Select chart container
    const chartContainer = document.querySelector('#completionChart');
    if (!chartContainer) {
      console.log('Completion chart container not yet available');
      return;
    }
    
    // Check if we have completed tasks
    if (!this.tasks || !Array.isArray(this.tasks) || 
        !this.tasks.some(task => task.done && task.completed_at)) {
      chartContainer.innerHTML = 'No completion data available yet';
      return;
    }
    
    // Clear any existing chart
    chartContainer.innerHTML = '';
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';
    chartContainer.appendChild(svg);
    
    // Create chart group
    const completionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    completionGroup.setAttribute('transform', 'translate(40, 20)');
    svg.appendChild(completionGroup);
    
    // Get completed tasks
    const completedTasks = this.tasks.filter(task => task.done && task.completed_at && !task.parent_id);
    
    // Group by week
    const weekData = this.getCompletionsByWeek(completedTasks);
    
    // Calculate dimensions
    const width = Math.max(400, chartContainer.clientWidth - 80);
    const height = 150;
    const barWidth = Math.min(40, (width / weekData.length) - 10);
    
    // Add axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '0');
    xAxis.setAttribute('y1', `${height}`);
    xAxis.setAttribute('x2', `${width}`);
    xAxis.setAttribute('y2', `${height}`);
    xAxis.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
    xAxis.setAttribute('stroke-width', '2');
    completionGroup.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '0');
    yAxis.setAttribute('y1', '0');
    yAxis.setAttribute('x2', '0');
    yAxis.setAttribute('y2', `${height}`);
    yAxis.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
    yAxis.setAttribute('stroke-width', '2');
    completionGroup.appendChild(yAxis);
    
    // Find maximum value for scaling
    const maxCount = Math.max(...weekData.map(d => d.count), 5);
    
    // Add bars
    weekData.forEach((week, index) => {
      const barHeight = (week.count / maxCount) * height;
      const x = (index * (width / weekData.length)) + ((width / weekData.length) - barWidth) / 2;
      const y = height - barHeight;
      
      // Create bar
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', x);
      bar.setAttribute('y', y);
      bar.setAttribute('width', barWidth);
      bar.setAttribute('height', barHeight);
      bar.setAttribute('fill', this.getAccentColor());
      bar.setAttribute('rx', '3');
      bar.setAttribute('ry', '3');
      
      // Add tooltip on hover
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${week.label}: ${week.count} tasks completed`;
      bar.appendChild(title);
      
      // Add hover effect
      bar.addEventListener('mouseenter', () => {
        bar.setAttribute('opacity', '0.8');
        bar.setAttribute('stroke', this.isDarkTheme ? '#fff' : '#000');
        bar.setAttribute('stroke-width', '1');
      });
      
      bar.addEventListener('mouseleave', () => {
        bar.setAttribute('opacity', '1');
        bar.setAttribute('stroke-width', '0');
      });
      
      completionGroup.appendChild(bar);
      
      // Add week label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + barWidth / 2);
      label.setAttribute('y', height + 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', this.isDarkTheme ? '#DDD' : '#333');
      label.setAttribute('font-size', '10px');
      label.textContent = week.shortLabel;
      completionGroup.appendChild(label);
      
      // Add count above bar
      const countLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      countLabel.setAttribute('x', x + barWidth / 2);
      countLabel.setAttribute('y', y - 5);
      countLabel.setAttribute('text-anchor', 'middle');
      countLabel.setAttribute('fill', this.isDarkTheme ? '#DDD' : '#333');
      countLabel.setAttribute('font-size', '10px');
      countLabel.textContent = week.count;
      completionGroup.appendChild(countLabel);
    });
  }
  
  getCompletionsByWeek(completedTasks) {
    // Get date range - last 4 weeks
    const today = new Date();
    const weeks = [];
    
    // Generate last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStartDate = new Date(today);
      weekStartDate.setDate(today.getDate() - (i * 7) - today.getDay());
      
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      
      const startMonth = weekStartDate.toLocaleString('default', { month: 'short' });
      const endMonth = weekEndDate.toLocaleString('default', { month: 'short' });
      
      const label = `${startMonth} ${weekStartDate.getDate()} - ${endMonth} ${weekEndDate.getDate()}`;
      const shortLabel = `W${3-i}`;
      
      weeks.push({
        startDate: weekStartDate,
        endDate: weekEndDate,
        label,
        shortLabel,
        count: 0
      });
    }
    
    // Count completed tasks per week
    completedTasks.forEach(task => {
      const completedDate = new Date(task.completed_at);
      
      // Find which week this task belongs to
      for (const week of weeks) {
        if (completedDate >= week.startDate && completedDate <= week.endDate) {
          week.count++;
          break;
        }
      }
    });
    
    return weeks;
  }

  getAccentColor() {
    // Get accent color from CSS variable or fallback to default
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue('--accent-color').trim() || '#4285f4';
  }

  handleData(data) {
    console.log('Received data from server:', data);
    
    // Check if data has the expected structure
    const taskData = data && data.data ? data.data : data;
    
    // Update the internal tasks array
    if (taskData && Array.isArray(taskData)) {
      // Store data for resize events
      this._lastData = taskData;
      
      // Update the internal tasks array
      this.tasks = taskData;
      
      // Filter active and completed tasks
      const activeTasks = taskData.filter(task => !task.done && !task.parent_id);
      const completedTasks = taskData.filter(task => task.done && !task.parent_id);
      
      // Calculate quadrant statistics
      this.calculateQuadrantStats(activeTasks);
      
      // Update the chart
      this.renderChart(taskData);
      
      // If Vue app is available, update its data
      if (this.vueApp) {
        try {
          // Check if Vue app and required methods are available
          if (typeof this.vueApp.$data !== 'undefined') {
            this.vueApp.tasks = taskData;
            this.vueApp.activeTasks = activeTasks;
            this.vueApp.completedTasks = completedTasks;
            
            // Also update quadrant stats if available
            if (this.quadrantStats && this.vueApp.quadrantStats) {
              this.vueApp.quadrantStats = { ...this.quadrantStats };
            }
          } else {
            console.log('Vue app data not available yet');
          }
        } catch (error) {
          console.error('Error updating Vue data:', error);
        }
      } else {
        // Emit update event even if Vue app is not set
        this.emitUpdate();
      }
    } else {
      console.error('Invalid data received from server:', data);
    }
  }

  renderChart(tasks) {
    console.log('--- SIMPLIFIED RENDER CHART ---');
    
    // Verify we have the dots group
    if (!this.dotsGroup) {
      console.error('No dots group available for rendering!');
      return;
    }
    
    // Use provided tasks or fall back to internal array
    const tasksToRender = tasks || this.tasks;
    
    // Make sure we have tasks
    if (!tasksToRender || !Array.isArray(tasksToRender)) {
      console.error('No tasks available to render');
      return;
    }
    
    // Filter for active parent tasks
    const activeTasks = tasksToRender.filter(task => !task.done && !task.parent_id);
    console.log(`Found ${activeTasks.length} active tasks to render`);
    
    // Clear any existing dots
    this.dotsGroup.innerHTML = '';
    
    // Make sure our purple test dot is always visible
    const testDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    testDot.setAttribute('cx', '350');
    testDot.setAttribute('cy', '250');
    testDot.setAttribute('r', '20');
    testDot.setAttribute('fill', 'purple');
    testDot.setAttribute('stroke', 'black');
    testDot.setAttribute('stroke-width', '2');
    this.dotsGroup.appendChild(testDot);
    
    // Add task dots
    activeTasks.forEach((task, index) => {
      // Use index for positioning if importance/urgency is not valid
      const importance = typeof task.importance === 'number' ? task.importance : 5;
      const urgency = typeof task.urgency === 'number' ? task.urgency : 5;
      
      // Calculate x, y position (moved from 0-10 scale to pixels)
      // x = 0 (left) to 700 (right) based on urgency (0-10)
      // y = 0 (top) to 500 (bottom) based on importance (10-0)
      const x = 50 + (urgency * 70); // 0-10 scale mapped to 0-700px
      const y = 500 - (importance * 50); // 10-0 scale mapped to 0-500px
      
      // Create dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', 15); // Large dot size
      
      // Color based on quadrant
      let fillColor;
      if (importance > 5 && urgency > 5) {
        fillColor = '#ff5252'; // Q1: red
      } else if (importance > 5 && urgency <= 5) {
        fillColor = '#4caf50'; // Q2: green
      } else if (importance <= 5 && urgency > 5) {
        fillColor = '#ff9800'; // Q3: orange
      } else {
        fillColor = '#2196f3'; // Q4: blue
      }
      
      // Set attributes
      dot.setAttribute('fill', fillColor);
      dot.setAttribute('stroke', 'black');
      dot.setAttribute('stroke-width', '2');
      dot.setAttribute('style', `fill: ${fillColor}; stroke: black; opacity: 1; visibility: visible;`);
      dot.setAttribute('data-task-id', task.id);
      dot.classList.add('task-dot');
      
      // Add a text label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', y - 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'black');
      label.setAttribute('font-size', '12px');
      label.setAttribute('font-weight', 'bold');
      label.textContent = task.name.substring(0, 15) + (task.name.length > 15 ? '...' : '');
      
      // Add to dots group
      this.dotsGroup.appendChild(dot);
      this.dotsGroup.appendChild(label);
      
      console.log(`Added dot for task ${task.id} at position ${x},${y}`);
    });
    
    console.log(`Successfully added ${activeTasks.length} task dots to the chart`);
  }
  
  getTaskDotSize(task) {
    // Make dots bigger for better visibility
    // We'll use a larger size (8) for debugging, but you can change back to 3 later
    return 8;
  }
  
  getQuadrantColorForTask(task) {
    // Get quadrant based on importance and urgency
    // Use hardcoded colors instead of CSS variables for reliability
    const isImportant = task.importance > 5;
    const isUrgent = task.urgency > 5;
    
    // Return hardcoded hex colors instead of CSS variables
    if (isImportant && isUrgent) {
      return '#ff5252'; // Q1: Important & Urgent (red)
    } else if (isImportant && !isUrgent) {
      return '#4caf50'; // Q2: Important & Not Urgent (green)
    } else if (!isImportant && isUrgent) {
      return '#ff9800'; // Q3: Not Important & Urgent (orange)
    } else {
      return '#2196f3'; // Q4: Not Important & Not Urgent (blue)
    }
  }
  
  showTooltip(content, element) {
    // If content is a DOM element, get its outer HTML
    if (typeof content === 'object' && content.outerHTML) {
      content = content.outerHTML;
    }
    
    // Remove any existing tooltips
    this.hideTooltip();
    
    // Create tooltip container if it doesn't exist
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'chart-tooltip';
      document.body.appendChild(this.tooltipElement);
    }
    
    // Update content
    this.tooltipElement.innerHTML = content;
    
    // Get element position
    const rect = element.getBoundingClientRect();
    const chartRect = this.chartGroup.getBoundingClientRect();
    
    // Position the tooltip
    this.tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    
    // Check if tooltip would appear above the screen's top border
    setTimeout(() => {
      const tooltipRect = this.tooltipElement.getBoundingClientRect();
      const spaceAbove = rect.top;
      const tooltipHeight = tooltipRect.height;
      
      // If tooltip would be cut off at the top of the viewport, position it below the element
      if (spaceAbove < tooltipHeight + 20) {
        this.tooltipElement.style.top = `${rect.bottom + 10}px`;
        this.tooltipElement.style.transform = 'translate(-50%, 0)';
      } else {
        this.tooltipElement.style.top = `${rect.top - 10}px`;
        this.tooltipElement.style.transform = 'translate(-50%, -100%)';
      }
      
      // Make tooltip visible
      this.tooltipElement.style.visibility = 'visible';
      this.tooltipElement.classList.add('visible');
    }, 10);
  }
  
  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
  }
  
  calculateQuadrantStats(tasks) {
    // Initialize quadrant stats if not already set
    if (!this.quadrantStats) {
      this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    } else {
      // Reset counters
      this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    }
    
    // Use provided tasks array or use active tasks from internal state
    const tasksToAnalyze = tasks || this.tasks.filter(task => !task.done && !task.parent_id);
    
    // Count tasks per quadrant
    tasksToAnalyze.forEach(task => {
      const quadrant = this.getQuadrantForTask(task);
      this.quadrantStats[quadrant]++;
    });
    
    // Return the quadrant stats for potential use elsewhere
    return this.quadrantStats;
  }
  
  getQuadrantForTask(task) {
    const highImportance = task.importance > 5;
    const highUrgency = task.urgency > 5;
    
    if (highImportance && highUrgency) return 'q1';
    if (highImportance && !highUrgency) return 'q2';
    if (!highImportance && highUrgency) return 'q3';
    return 'q4';
  }
  
  focusOnTask(taskId) {
    // Clear previous selections
    document.querySelectorAll('.selected-task').forEach(el => {
      el.classList.remove('selected-task');
    });
    
    document.querySelectorAll('.selected-dot').forEach(el => {
      el.classList.remove('selected-dot');
      el.setAttribute('r', this.getTaskDotSize(this.tasks.find(t => t.id === parseInt(el.getAttribute('data-task-id')))));
    });
    
    // Find the task
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Highlight the task in the list
    const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
    if (taskElement) {
      taskElement.classList.add('selected-task');
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Highlight the dot in the chart
    const dot = document.querySelector(`.task-dot[data-task-id="${taskId}"]`);
    if (dot) {
      dot.classList.add('selected-dot');
      dot.setAttribute('r', parseFloat(this.getTaskDotSize(task)) * 1.5);
      dot.setAttribute('stroke-width', '3');
      dot.setAttribute('stroke', this.isDarkTheme ? '#fff' : '#000');
      
      // Create a pulse effect
      this.showRippleEffect(dot);
      
      // Show a notification
      this.showNotification(`Focused on task: ${task.name}`, 'info', '🔍');
    }
  }
  
  showRippleEffect(dot) {
    const cx = parseFloat(dot.getAttribute('cx'));
    const cy = parseFloat(dot.getAttribute('cy'));
    const r = parseFloat(dot.getAttribute('r'));
    
    // Create ripple circle
    const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ripple.setAttribute('cx', cx);
    ripple.setAttribute('cy', cy);
    ripple.setAttribute('r', r);
    ripple.setAttribute('fill', 'none');
    ripple.setAttribute('stroke', this.isDarkTheme ? '#fff' : '#000');
    ripple.setAttribute('stroke-width', '2');
    ripple.setAttribute('class', 'ripple-effect');
    
    // Add animation
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'r');
    animate.setAttribute('from', r);
    animate.setAttribute('to', r * 3);
    animate.setAttribute('dur', '1s');
    animate.setAttribute('begin', '0s');
    animate.setAttribute('repeatCount', '1');
    ripple.appendChild(animate);
    
    const animateOpacity = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateOpacity.setAttribute('attributeName', 'opacity');
    animateOpacity.setAttribute('from', '0.8');
    animateOpacity.setAttribute('to', '0');
    animateOpacity.setAttribute('dur', '1s');
    animateOpacity.setAttribute('begin', '0s');
    animateOpacity.setAttribute('repeatCount', '1');
    ripple.appendChild(animateOpacity);
    
    // Add to chart and remove after animation completes
    this.chartGroup.appendChild(ripple);
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 1000);
  }
  
  handleTaskClick(event) {
    const taskId = event.currentTarget.dataset.taskId;
    this.focusOnTask(taskId); // Focus on the task in the chart
    // Additional logic to scroll to the task in the chart if needed
    const taskDot = document.querySelector(`circle[data-task-id="${taskId}"]`);
    if (taskDot) {
        taskDot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  addTask(taskData) {
    if (!taskData || !taskData.name) {
      console.error('Invalid task data:', taskData);
      return Promise.reject(new Error('Invalid task data'));
    }

    return new Promise((resolve, reject) => {
      // Define a one-time handler for task added response
      const onTaskAdded = (response) => {
        console.log('Task added response:', response);
        this.socket.off('taskAdded', onTaskAdded); // Remove the listener
        
        if (response.success) {
          // Show notification
          this.showNotification(`Task added: ${taskData.name}`, 'success', '✅');
          resolve(response);
        } else {
          reject(new Error('Failed to add task'));
        }
      };
      
      // Listen for the response
      this.socket.on('taskAdded', onTaskAdded);
      
      // Send the task to the server
      this.socket.emit('addTask', taskData);
    });
  }

  toggleDone(taskId) {
    // Find the task before toggling to determine previous state
    let previousDoneState = false;
    if (this.tasks && Array.isArray(this.tasks)) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        previousDoneState = task.done;
      }
    }

    // Send the toggle request to the server
    this.socket.emit('toggleDone', taskId);

    // Fix for issue #2: ensure tasks exist before trying to find one
    if (this.tasks && Array.isArray(this.tasks)) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        // Instead of relying on the current state (which might not be updated yet),
        // use the previous state to determine the action that was just taken
        const actionTaken = previousDoneState ? 'reopened' : 'completed';
        const icon = previousDoneState ? '🔄' : '🎉';
        this.showNotification(`Task ${actionTaken}: ${task.name}`, 'success', icon);
      } else {
        // Task not found, use generic message
        this.showNotification(`Task status changed`, 'success', '🔄');
      }
    } else {
      // If tasks array doesn't exist, use generic message
      this.showNotification(`Task status changed`, 'success', '🔄');
    }
  }

  addSubtask(subtask, parentId) {
    console.log('TaskManager.addSubtask called with:', subtask, 'parentId:', parentId);
    
    // Find parent task name for better notification
    let parentName = "Unknown";
    if (this.tasks && Array.isArray(this.tasks)) {
      const parentTask = this.tasks.find(t => t.id === parentId);
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
      this.socket.off('updateTasks', onSubtaskAdded);
    };
    
    // Listen for response
    this.socket.once('updateTasks', onSubtaskAdded);
    
    // Send the request
    this.socket.emit('addSubtask', { subtask, parentId });
  }

  updateSubtask(subtask) {
    console.log('TaskManager.updateSubtask called with:', subtask);
    
    // Store original subtask data for comparison if available
    let originalSubtask = null;
    if (this.tasks && Array.isArray(this.tasks)) {
      originalSubtask = this.tasks.find(t => t.id === subtask.id);
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
            changeDescription = `Updated ${changes.join(", ")} for subtask "${subtask.name}"`;
          } else {
            changeDescription = `Updated subtask "${subtask.name}"`;
          }
        }
        
        this.showNotification(changeDescription, 'success', '✏️');
      }
      
      // Remove the listener to avoid accumulating handlers
      this.socket.off('updateTasks', onSubtaskUpdated);
    };
    
    // Listen for response
    this.socket.once('updateTasks', onSubtaskUpdated);
    
    // Send the request
    this.socket.emit('updateSubtask', { subtask });
  }

  showNotification(message, type = 'default', icon = '📢') {
    const container = document.getElementById('notification-container');
    if (!container) {
      console.error('Notification container not found');
      return null;
    }
    
    // Create notification element with enhanced styling
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon, message, and close button
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
      </div>
      <button class="notification-close" aria-label="Close notification">&times;</button>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Add click listener to close button
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        notification.classList.add('notification-hiding');
        setTimeout(() => {
          notification.remove();
        }, 300);
      });
    }
    
    // Add animation classes
    setTimeout(() => {
      notification.classList.add('notification-visible');
    }, 10);
    
    // Remove after animation completes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('notification-hiding');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
    
    return notification;
  }

  // Initialize TaskManager and request initial data
  init() {
    console.log('Initializing TaskManager');
    
    // Request initial data if socket is connected
    if (this.socket && this.socket.connected) {
      console.log('Socket connected, requesting initial data');
      this.socket.emit('requestInitialData');
    } else if (this.socket) {
      // If not connected, wait for connection and then request data
      console.log('Socket not connected, waiting for connection');
      this.socket.on('connect', () => {
        console.log('Socket now connected, requesting initial data');
        this.socket.emit('requestInitialData');
      });
    }
    
    // Initialize chart (just once)
    this.initializeChart();
    
    // No need for extra event listeners or multiple delayed renders
    // A single delayed render is sufficient as a fallback
    setTimeout(() => {
      if (this.tasks && this.tasks.length > 0) {
        console.log(`Fallback: rendering ${this.tasks.length} tasks after delay`);
        this.renderChart(this.tasks);
      }
    }, 1000);
    
    // Emit an event to let consumers know we're initialized
    this.emitUpdate();
    
    return this;
  }
  
  // Emit update event for Vue integration
  emitUpdate() {
    // Only emit if we have tasks
    if (this.tasks) {
      // Create and dispatch a custom event for Vue integration
      const event = new CustomEvent('tasksUpdated', {
        detail: { tasks: this.tasks }
      });
      window.dispatchEvent(event);
    }
  }

  showTaskDetails(task) {
    console.log('Showing details for task:', task);
    
    // Store selected task ID
    this.selectedTaskId = task.id;
    
    // Clear any existing focus announcements
    const existingAnnouncements = document.querySelectorAll('.focus-announcement');
    existingAnnouncements.forEach(el => el.remove());
    
    // Create a single focus announcement
    const announcement = document.createElement('div');
    announcement.className = 'focus-announcement';
    announcement.innerHTML = `
      <span class="focus-icon">🔍</span>
      <span>Focused on task: ${task.name}</span>
      <span class="close-announcement">×</span>
    `;
    document.body.appendChild(announcement);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (announcement && announcement.parentNode) {
        announcement.remove();
      }
    }, 4000);
    
    // Add close button functionality
    const closeBtn = announcement.querySelector('.close-announcement');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        announcement.remove();
      });
    }
    
    // Trigger an event that Vue can listen to
    const event = new CustomEvent('taskSelected', {
      detail: { task }
    });
    window.dispatchEvent(event);
    
    // Focus on the task in the active tasks list with a slight delay to ensure DOM is updated
    setTimeout(() => {
      this.focusOnTaskInList(task.id);
    }, 100);
    
    // If Vue app is available, select the task there too
    if (this.vueApp) {
      this.vueApp.selectedTaskId = task.id;
    }
  }
  
  focusOnTaskInList(taskId) {
    console.log(`Focusing on task ID ${taskId} in the list view`);
    
    // Find the task element in the list - try various selectors to ensure we find it
    let taskElement = document.querySelector(`.vue-task-item[data-task-id="${taskId}"], .task[data-task-id="${taskId}"]`);
    
    // If not found, try a more general approach (any element with that task-id)
    if (!taskElement) {
      taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      // Only use elements in the task list
      if (taskElement && !taskElement.closest('.task-table, .tasks-container')) {
        taskElement = null;
      }
    }
    
    if (taskElement) {
      console.log(`Found task element for ID ${taskId}, highlighting and scrolling to it`);
      
      // Remove highlight from all tasks
      document.querySelectorAll('.vue-task-item.selected, .task.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Add highlight to this task
      taskElement.classList.add('selected');
      
      // Make sure the task container is visible
      const taskContainer = taskElement.closest('.tasks-container, .task-container');
      if (taskContainer && taskContainer.style.display === 'none') {
        taskContainer.style.display = 'block';
      }
      
      // Scroll task into view with smooth animation - ensure it's centered
      taskElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
      
      // Add a brief highlight animation
      taskElement.classList.add('highlight-pulse');
      setTimeout(() => {
        taskElement.classList.remove('highlight-pulse');
      }, 1500);
      
      return true;
    } else {
      console.warn(`Task element with ID ${taskId} not found in the list view`);
      
      // Try to find any task-related element as a fallback
      const anyTaskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (anyTaskElement) {
        console.log(`Found a related element, attempting to scroll to it`);
        anyTaskElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
        return true;
      }
      
      return false;
    }
  }

  deleteTask(taskId) {
    console.log('TaskManager.deleteTask called with:', taskId);
    
    // Find task before deletion for notification
    let taskName = "Unknown";
    if (this.tasks && Array.isArray(this.tasks)) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        taskName = task.name;
      }
    }
    
    // Define one-time handler for task deleted response
    const onTaskDeleted = (response) => {
      console.log('Task deleted response:', response);
      if (response) {
        this.showNotification(`Deleted task "${taskName}"`, 'success', '🗑️');
      }
      // Remove the listener to avoid accumulating handlers
      this.socket.off('updateTasks', onTaskDeleted);
    };
    
    // Listen for response
    this.socket.once('updateTasks', onTaskDeleted);
    
    // Send the delete request
    this.socket.emit('deleteTask', taskId);
  }

  renderTasks(tasks) {
    // Clear existing tasks
    this.taskList.innerHTML = '';

    // Group tasks by parentId
    const groupedTasks = tasks.reduce((acc, task) => {
        if (!task.parentId) {
            acc[task.id] = { ...task, subtasks: [] };
        } else {
            acc[task.parentId].subtasks.push(task);
        }
        return acc;
    }, {});

    // Render each parent task and its subtasks
    Object.values(groupedTasks).forEach(parentTask => {
        const taskElement = this.createTaskElement(parentTask);
        this.taskList.appendChild(taskElement);

        // Render subtasks
        if (parentTask.subtasks.length > 0) {
            const subtasksContainer = document.createElement('div');
            subtasksContainer.classList.add('subtasks-container');
            parentTask.subtasks.forEach(subtask => {
                const subtaskElement = this.createSubtaskElement(subtask);
                subtasksContainer.appendChild(subtaskElement);
            });
            taskElement.appendChild(subtasksContainer);
        }
    });
  }

  calculateTaskPosition(task) {
    console.log(`DIAGNOSTIC: calculateTaskPosition for task ${task.id}`);
    
    // Make sure we have valid chart dimensions
    if (!this.chartWidth || !this.chartHeight) {
      console.warn('Chart dimensions not available, using defaults');
      this.chartWidth = 740;
      this.chartHeight = 520;
    }

    // Ensure we have valid importance and urgency values
    // Default to middle values (5,5) if missing or invalid
    const importance = (typeof task.importance === 'number' && !isNaN(task.importance)) 
      ? task.importance 
      : 5;
    const urgency = (typeof task.urgency === 'number' && !isNaN(task.urgency)) 
      ? task.urgency 
      : 5;
    
    console.log(`DIAGNOSTIC: Using values: importance=${importance}, urgency=${urgency}`);
    
    // Add significant padding to ensure dots are well within the visible area
    const padding = 60; // More padding to keep dots away from edges
    
    // Calculate available space after padding
    const availableWidth = this.chartWidth - (padding * 2);
    const availableHeight = this.chartHeight - (padding * 2);
    
    // Calculate position with even distribution across the chart
    // Scale from 0-10 range to padded chart dimensions
    const xScale = availableWidth / 10;
    const yScale = availableHeight / 10;
    
    // Calculate position (invert y-axis since SVG 0,0 is top-left)
    const x = padding + (urgency * xScale);
    const y = this.chartHeight - padding - (importance * yScale);
    
    console.log(`DIAGNOSTIC: Final position: x=${x}, y=${y}, chartWidth=${this.chartWidth}, chartHeight=${this.chartHeight}`);
    
    return { x, y };
  }

  createTaskDot(task, x, y, dotSize) {
    console.log(`DIAGNOSTIC: createTaskDot for task ${task.id} at position (${x}, ${y}) with size ${dotSize}`);
    
    try {
      // Ensure we have a valid task ID
      if (!task || !task.id) {
        console.error('Invalid task object passed to createTaskDot:', task);
        return null;
      }
      
      // IMPORTANT: Create more visible dots
      
      // Create the dot with proper SVG namespace
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      
      // Set essential attributes for visibility
      dot.setAttribute("visibility", "visible");
      dot.setAttribute("pointer-events", "all");
      dot.setAttribute("opacity", "1");
      
      // Set all required attributes
      dot.setAttribute("data-task-id", task.id);
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", dotSize);
      
      // Get color based on quadrant - use hardcoded colors
      const fillColor = this.getQuadrantColorForTask(task);
      dot.setAttribute("fill", fillColor);
      
      // For extra visibility, add a style attribute with inline CSS
      dot.setAttribute("style", `fill: ${fillColor}; stroke: black; stroke-width: 1px; opacity: 1; visibility: visible;`);
      
      // Add classes for styling
      dot.classList.add("task-dot");
      
      // Add a stroke for better visibility
      dot.setAttribute("stroke", '#000');
      dot.setAttribute("stroke-width", "1");
      
      // Add a title attribute for hover text
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = task.name;
      dot.appendChild(title);
      
      console.log(`DIAGNOSTIC: Dot created successfully with color ${fillColor}`);

      // RENDER TEST: Add the dot directly to the SVG to test rendering
      if (this.chartGroup) {
        // Create a testing rectangle at the same position
        const testRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        testRect.setAttribute("x", x - 5);
        testRect.setAttribute("y", y - 5);
        testRect.setAttribute("width", 10);
        testRect.setAttribute("height", 10);
        testRect.setAttribute("fill", "yellow");
        testRect.setAttribute("stroke", "red");
        this.chartGroup.appendChild(testRect);
      }
      
      return dot;
    } catch (error) {
      console.error('Error creating task dot:', error);
      return null;
    }
  }

  addDotInteractions(dot, task) {
    // Get subtasks
    const subtasks = this.tasks ? this.tasks.filter(t => t.parent_id === task.id) : [];
    
    // Create tooltip content
    const tooltipContent = this.createTooltipContent(task, subtasks);
    
    // Store the original radius as a data attribute
    const originalRadius = this.getTaskDotSize(task);
    dot.setAttribute('data-original-radius', originalRadius);
    
    // Mouse enter - show tooltip and enlarge dot
    dot.addEventListener('mouseenter', () => {
      // Enlarge the dot on hover using the stored original radius
      const storedRadius = parseFloat(dot.getAttribute('data-original-radius'));
      dot.setAttribute('r', storedRadius * 1.3);
      dot.setAttribute('stroke-width', '2');
      dot.setAttribute('stroke', this.isDarkTheme ? '#fff' : '#000');
      
      // Show tooltip
      this.showTooltip(tooltipContent, dot);
    });
    
    // Mouse leave - hide tooltip and restore dot size
    dot.addEventListener('mouseleave', () => {
      // Restore original size unless it's the selected dot
      if (!dot.classList.contains('selected-dot')) {
        const storedRadius = parseFloat(dot.getAttribute('data-original-radius'));
        dot.setAttribute('r', storedRadius);
        dot.setAttribute('stroke-width', '1.5');
        dot.removeAttribute('stroke');
      }
      
      // Hide tooltip
      this.hideTooltip();
    });
    
    // Click - select the task
    dot.addEventListener('click', (event) => {
      event.stopPropagation();
      
      // Set this as the selected task
      this.selectedTaskId = task.id;
      
      // Remove selected class from all dots
      document.querySelectorAll('.selected-dot').forEach(el => {
        el.classList.remove('selected-dot');
        // Reset dot size
        const storedRadius = parseFloat(el.getAttribute('data-original-radius'));
        el.setAttribute('r', storedRadius);
        el.removeAttribute('stroke');
      });
      
      // Add selected class to this dot
      dot.classList.add('selected-dot');
      const storedRadius = parseFloat(dot.getAttribute('data-original-radius'));
      dot.setAttribute('r', storedRadius * 1.3);
      dot.setAttribute('stroke-width', '2');
      dot.setAttribute('stroke', this.isDarkTheme ? '#fff' : '#000');
      
      // Focus task in list view
      this.focusOnTaskInList(task.id);
      
      // Show a ripple effect
      this.showRippleEffect(dot);
    });
  }
  
  createTooltipContent(task, subtasks) {
    // Get subtasks if not provided
    if (!subtasks && this.tasks) {
      subtasks = this.tasks.filter(t => t.parent_id === task.id);
    }
    
    const totalSubtasks = subtasks ? subtasks.length : 0;
    const completedSubtasks = subtasks ? subtasks.filter(t => t.done).length : 0;
    
    let content = `
      <div class="tooltip-header">
        <div class="tooltip-title">
          <span class="tooltip-importance-marker" 
                style="background-color: ${this.getQuadrantColorForTask(task)}"></span>
          <strong>${task.name || task.title}</strong>
        </div>
        <div class="tooltip-metrics">
          <span class="tooltip-metric">Importance: ${task.importance}/10</span>
          <span class="tooltip-metric">Urgency: ${task.urgency}/10</span>
        </div>
      </div>
    `;
    
    // Add due date if exists
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const today = new Date();
      const isOverdue = dueDate < today;
      
      content += `
        <div class="tooltip-due-date ${isOverdue ? 'overdue' : ''}">
          Due: ${dueDate.toLocaleDateString()}
          ${isOverdue ? ' (Overdue)' : ''}
        </div>
      `;
    }

    // Add subtasks if available
    if (totalSubtasks > 0) {
      content += `
        <div class="tooltip-subtasks">
          <div class="tooltip-subtasks-header">
            <strong>Subtasks (${completedSubtasks}/${totalSubtasks})</strong>
          </div>
      `;
      
      // Add up to 3 subtasks for preview
      const previewSubtasks = subtasks.slice(0, 3);
      previewSubtasks.forEach(subtask => {
        content += `
          <div class="tooltip-subtask ${subtask.done ? 'completed' : ''}">
            <span class="subtask-status">${subtask.done ? '✓' : '○'}</span>
            <span class="subtask-name">${subtask.name || subtask.title}</span>
          </div>
        `;
      });
      
      // Add "more" indicator if there are additional subtasks
      if (totalSubtasks > 3) {
        content += `<div class="tooltip-more">+${totalSubtasks - 3} more</div>`;
      }
      
      content += `</div>`;
    }
    
    return content;
  }

  // Add test dots that should be clearly visible
  addVisibleTestDots() {
    console.log('Adding visible test dots directly to SVG');
    
    // Get the chart container
    const chartContainer = document.querySelector('#taskChart');
    if (!chartContainer) {
      console.error('Cannot find chart container');
      return;
    }
    
    // Create an inline SVG element with a direct DOM insertion
    const testSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    testSvg.setAttribute("width", "100%");
    testSvg.setAttribute("height", "100%");
    testSvg.setAttribute("style", "position: absolute; top: 0; left: 0; z-index: 9999;");
    
    // Add test dots
    // Red dot at top-left
    const dot1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot1.setAttribute("cx", "30");
    dot1.setAttribute("cy", "30");
    dot1.setAttribute("r", "15");
    dot1.setAttribute("fill", "red");
    dot1.setAttribute("stroke", "black");
    dot1.setAttribute("stroke-width", "2");
    
    // Green dot at top-right
    const dot2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot2.setAttribute("cx", "730");
    dot2.setAttribute("cy", "30");
    dot2.setAttribute("r", "15");
    dot2.setAttribute("fill", "green");
    dot2.setAttribute("stroke", "black");
    dot2.setAttribute("stroke-width", "2");
    
    // Blue dot at bottom-left
    const dot3 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot3.setAttribute("cx", "30");
    dot3.setAttribute("cy", "490");
    dot3.setAttribute("r", "15");
    dot3.setAttribute("fill", "blue");
    dot3.setAttribute("stroke", "black");
    dot3.setAttribute("stroke-width", "2");
    
    // Yellow dot at bottom-right
    const dot4 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot4.setAttribute("cx", "730");
    dot4.setAttribute("cy", "490");
    dot4.setAttribute("r", "15");
    dot4.setAttribute("fill", "yellow");
    dot4.setAttribute("stroke", "black");
    dot4.setAttribute("stroke-width", "2");
    
    // Add all dots to the test SVG
    testSvg.appendChild(dot1);
    testSvg.appendChild(dot2);
    testSvg.appendChild(dot3);
    testSvg.appendChild(dot4);
    
    // Add to the chart container
    chartContainer.appendChild(testSvg);
    
    console.log('Test dots added directly to the DOM');
  }
}
