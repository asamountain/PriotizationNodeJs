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
      this.renderChart();
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
    console.log('TaskManager.initializeChart called');
    
    // Select chart container
    const chartContainer = document.querySelector('#taskChart');
    if (!chartContainer) {
      console.error('Chart container #taskChart not found');
      return;
    }
    
    // Clear any existing chart
    chartContainer.innerHTML = '';
    
    // Get container dimensions for responsive sizing
    const containerWidth = chartContainer.clientWidth || 600;
    const containerHeight = chartContainer.clientHeight || 450;
    
    // Create SVG element with responsive viewBox that better utilizes the space
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 860 660'); // Increased from 800x600 for better fit
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.overflow = 'visible';
    chartContainer.appendChild(svg);
    
    // Create chart group with proper margins - decreased margins to use more space
    this.chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.chartGroup.setAttribute('transform', 'translate(60, 45)'); // Adjusted for better positioning
    svg.appendChild(this.chartGroup);
    
    // Define chart dimensions - increased for more space
    const chartWidth = 740; // Increased from 660 for better use of space
    const chartHeight = 520; // Increased from 480 for better proportions
    
    // Add chart background for better visual definition
    const chartBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    chartBackground.setAttribute('x', 0);
    chartBackground.setAttribute('y', 0);
    chartBackground.setAttribute('width', chartWidth);
    chartBackground.setAttribute('height', chartHeight);
    chartBackground.setAttribute('rx', '12'); // More rounded corners
    chartBackground.setAttribute('ry', '12');
    chartBackground.setAttribute('fill', this.isDarkTheme ? 'rgba(30, 30, 30, 0.2)' : 'rgba(248, 249, 250, 0.7)');
    chartBackground.setAttribute('stroke', this.isDarkTheme ? '#444' : '#ddd');
    chartBackground.setAttribute('stroke-width', '1');
    this.chartGroup.appendChild(chartBackground);
    
    // Add X and Y axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '0');
    xAxis.setAttribute('y1', `${chartHeight}`);
    xAxis.setAttribute('x2', `${chartWidth}`);
    xAxis.setAttribute('y2', `${chartHeight}`);
    xAxis.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
    xAxis.setAttribute('stroke-width', '2');
    this.chartGroup.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '0');
    yAxis.setAttribute('y1', '0');
    yAxis.setAttribute('x2', '0');
    yAxis.setAttribute('y2', `${chartHeight}`);
    yAxis.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
    yAxis.setAttribute('stroke-width', '2');
    this.chartGroup.appendChild(yAxis);
    
    // Add X and Y labels
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', `${chartWidth / 2}`);
    xLabel.setAttribute('y', `${chartHeight + 35}`); // Moved down to avoid overlap
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('fill', this.isDarkTheme ? '#DDD' : '#333');
    xLabel.setAttribute('font-size', '16px'); // Larger font
    xLabel.setAttribute('font-weight', '500'); // Slightly bolder
    xLabel.textContent = 'Urgency';
    this.chartGroup.appendChild(xLabel);
    
    // Add X axis ticks with more values for better reference
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].forEach((label, i) => {
      const x = (i / 9) * chartWidth;
      const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tickLine.setAttribute('x1', x);
      tickLine.setAttribute('y1', chartHeight);
      tickLine.setAttribute('x2', x);
      tickLine.setAttribute('y2', chartHeight + 5);
      tickLine.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
      tickLine.setAttribute('stroke-width', '1');
      
      // Only show every other tick label on smaller screens
      if (i % 2 === 0 || containerWidth > 600) {
        const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tickText.setAttribute('x', x);
        tickText.setAttribute('y', chartHeight + 20);
        tickText.setAttribute('text-anchor', 'middle');
        tickText.setAttribute('fill', this.isDarkTheme ? '#BBB' : '#666');
        tickText.setAttribute('font-size', '12px');
        tickText.textContent = label;
        this.chartGroup.appendChild(tickText);
      }
      
      this.chartGroup.appendChild(tickLine);
    });
    
    // Add more descriptive low/high labels
    ['Low Urgency', 'High Urgency'].forEach((label, i) => {
      const x = i === 0 ? 5 : chartWidth - 5;
      const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tickText.setAttribute('x', x);
      tickText.setAttribute('y', chartHeight + 35);
      tickText.setAttribute('text-anchor', i === 0 ? 'start' : 'end');
      tickText.setAttribute('fill', this.isDarkTheme ? '#BBB' : '#666');
      tickText.setAttribute('font-size', '13px');
      tickText.setAttribute('font-style', 'italic');
      tickText.textContent = label;
      this.chartGroup.appendChild(tickText);
    });
    
    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('transform', `rotate(-90, -40, ${chartHeight / 2})`);
    yLabel.setAttribute('x', `-40`);
    yLabel.setAttribute('y', `${chartHeight / 2}`);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('fill', this.isDarkTheme ? '#DDD' : '#333');
    yLabel.setAttribute('font-size', '16px'); // Larger font
    yLabel.setAttribute('font-weight', '500'); // Slightly bolder
    yLabel.textContent = 'Importance';
    this.chartGroup.appendChild(yLabel);
    
    // Add Y axis ticks with more values for better reference
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].forEach((label, i) => {
      const y = chartHeight - (i / 9) * chartHeight;
      const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tickLine.setAttribute('x1', -5);
      tickLine.setAttribute('y1', y);
      tickLine.setAttribute('x2', 0);
      tickLine.setAttribute('y2', y);
      tickLine.setAttribute('stroke', this.isDarkTheme ? '#777' : '#999');
      tickLine.setAttribute('stroke-width', '1');
      
      // Only show every other tick label on smaller screens
      if (i % 2 === 0 || containerHeight > 400) {
        const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tickText.setAttribute('x', -10);
        tickText.setAttribute('y', y + 4); // Offset for centering text
        tickText.setAttribute('text-anchor', 'end');
        tickText.setAttribute('fill', this.isDarkTheme ? '#BBB' : '#666');
        tickText.setAttribute('font-size', '12px');
        tickText.textContent = label;
        this.chartGroup.appendChild(tickText);
      }
      
      this.chartGroup.appendChild(tickLine);
    });
    
    // Add more descriptive low/high labels
    ['Low Importance', 'High Importance'].forEach((label, i) => {
      const y = i === 0 ? chartHeight - 5 : 15;
      const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tickText.setAttribute('x', -15);
      tickText.setAttribute('y', y);
      tickText.setAttribute('text-anchor', 'end');
      tickText.setAttribute('alignment-baseline', i === 0 ? 'auto' : 'hanging');
      tickText.setAttribute('fill', this.isDarkTheme ? '#BBB' : '#666');
      tickText.setAttribute('font-size', '13px');
      tickText.setAttribute('font-style', 'italic');
      tickText.textContent = label;
      this.chartGroup.appendChild(tickText);
    });
    
    // Add quadrant lines and labels
    const midX = chartWidth / 2;
    const midY = chartHeight / 2;
    
    const horizontalMidLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    horizontalMidLine.setAttribute('x1', '0');
    horizontalMidLine.setAttribute('y1', `${midY}`);
    horizontalMidLine.setAttribute('x2', `${chartWidth}`);
    horizontalMidLine.setAttribute('y2', `${midY}`);
    horizontalMidLine.setAttribute('stroke', this.isDarkTheme ? '#555' : '#ccc');
    horizontalMidLine.setAttribute('stroke-width', '1');
    horizontalMidLine.setAttribute('stroke-dasharray', '5,5');
    this.chartGroup.appendChild(horizontalMidLine);
    
    const verticalMidLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    verticalMidLine.setAttribute('x1', `${midX}`);
    verticalMidLine.setAttribute('y1', '0');
    verticalMidLine.setAttribute('x2', `${midX}`);
    verticalMidLine.setAttribute('y2', `${chartHeight}`);
    verticalMidLine.setAttribute('stroke', this.isDarkTheme ? '#555' : '#ccc');
    verticalMidLine.setAttribute('stroke-width', '1');
    verticalMidLine.setAttribute('stroke-dasharray', '5,5');
    this.chartGroup.appendChild(verticalMidLine);
    
    // Add grid lines
    for (let i = 1; i < 10; i++) {
      // Vertical grid lines
      if (i % 2 === 0 && i !== 5) {
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', (chartWidth / 10) * i);
        gridLine.setAttribute('y1', 0);
        gridLine.setAttribute('x2', (chartWidth / 10) * i);
        gridLine.setAttribute('y2', chartHeight);
        gridLine.setAttribute('stroke', this.isDarkTheme ? 'rgba(100, 100, 100, 0.1)' : 'rgba(200, 200, 200, 0.5)');
        gridLine.setAttribute('stroke-width', '1');
        this.chartGroup.appendChild(gridLine);
      }
      
      // Horizontal grid lines
      if (i % 2 === 0 && i !== 5) {
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', 0);
        gridLine.setAttribute('y1', (chartHeight / 10) * i);
        gridLine.setAttribute('x2', chartWidth);
        gridLine.setAttribute('y2', (chartHeight / 10) * i);
        gridLine.setAttribute('stroke', this.isDarkTheme ? 'rgba(100, 100, 100, 0.1)' : 'rgba(200, 200, 200, 0.5)');
        gridLine.setAttribute('stroke-width', '1');
        this.chartGroup.appendChild(gridLine);
      }
    }
    
    // Add quadrant labels with improved positioning and larger size
    this.addQuadrantLabel('Q1', midX / 2, midY / 2, 'Urgent & Important');
    this.addQuadrantLabel('Q2', midX + midX / 2, midY / 2, 'Important, Not Urgent');
    this.addQuadrantLabel('Q3', midX / 2, midY + midY / 2, 'Urgent, Not Important');
    this.addQuadrantLabel('Q4', midX + midX / 2, midY + midY / 2, 'Neither Urgent nor Important');
    
    // Create a group specifically for task dots
    this.dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.dotsGroup.classList.add('task-dots');
    this.chartGroup.appendChild(this.dotsGroup);
    
    // Store chart dimensions for later use
    this.chartWidth = chartWidth;
    this.chartHeight = chartHeight;
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

  addQuadrantLabel(text, x, y, description) {
    // Create group for the label
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.classList.add('quadrant-label');
    
    // Determine color based on quadrant
    let color;
    switch(text) {
      case 'Q1': color = 'var(--q1-color, #f72585)'; break;
      case 'Q2': color = 'var(--q2-color, #4caf50)'; break;
      case 'Q3': color = 'var(--q3-color, #ff9800)'; break;
      case 'Q4': color = 'var(--q4-color, #2196f3)'; break;
      default: color = this.isDarkTheme ? '#DDD' : '#333';
    }
    
    // Create background/container for the label - larger boxes for better visibility
    const bgWidth = description ? 160 : 50; // Increased width
    const bgHeight = description ? 55 : 36; // Increased height
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', x - bgWidth/2);
    bgRect.setAttribute('y', y - 20); // Adjusted y position
    bgRect.setAttribute('width', bgWidth);
    bgRect.setAttribute('height', bgHeight);
    bgRect.setAttribute('rx', '6');
    bgRect.setAttribute('ry', '6');
    bgRect.setAttribute('fill', this.isDarkTheme ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)');
    bgRect.setAttribute('stroke', color);
    bgRect.setAttribute('stroke-width', '2'); // Thicker border for emphasis
    // Add drop shadow for depth
    bgRect.setAttribute('filter', 'drop-shadow(0px 2px 3px rgba(0,0,0,0.15))');
    labelGroup.appendChild(bgRect);
    
    // Add main label - larger and more prominent
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('fill', color);
    label.setAttribute('font-size', '18px'); // Increased from 16px
    label.textContent = text;
    labelGroup.appendChild(label);
    
    // Add description below - improved readability
    if (description) {
      const descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      descText.setAttribute('x', x);
      descText.setAttribute('y', y + 20); // Increased spacing
      descText.setAttribute('text-anchor', 'middle');
      descText.setAttribute('fill', this.isDarkTheme ? '#BBB' : '#666');
      descText.setAttribute('font-size', '11px'); // Increased from 10px
      descText.textContent = description;
      labelGroup.appendChild(descText);
    }
    
    // Add a subtle hover effect
    labelGroup.addEventListener('mouseenter', () => {
      bgRect.setAttribute('stroke-width', '3');
      bgRect.setAttribute('fill', this.isDarkTheme ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 1)');
      label.setAttribute('font-size', '19px');
    });
    
    labelGroup.addEventListener('mouseleave', () => {
      bgRect.setAttribute('stroke-width', '2');
      bgRect.setAttribute('fill', this.isDarkTheme ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)');
      label.setAttribute('font-size', '18px');
    });
    
    this.chartGroup.appendChild(labelGroup);
    return labelGroup;
  }

  handleData(data) {
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid data received:', data);
      return;
    }
    
    try {
      console.log('Received data:', data.data);
      
      // Store data for resize events
      this._lastData = data.data;
      
      // IMPORTANT: Update the tasks property to fix issue #2
      this.tasks = data.data;
      
      // Call the Vue callback if it exists
      if (this.onTasksUpdate && typeof this.onTasksUpdate === 'function') {
        console.log('Calling Vue callback with data:', data.data.length, 'tasks');
        this.onTasksUpdate(data.data);
      } else {
        console.warn('Vue callback not available');
        // Emit update event even if callback is not set
        this.emitUpdate();
      }
      
      // Render the chart with the new data
      this.renderChart();
    } catch (error) {
      console.error('Data rendering error:', error);
    }
  }

  renderChart(tasks) {
    if (!this.chartGroup) {
      console.error('Cannot render chart: chart group not available');
      return;
    }
    
    // Use provided tasks or fall back to the internal tasks array
    const tasksToRender = tasks || this.tasks;
    
    if (!tasksToRender || !Array.isArray(tasksToRender)) {
      console.error('Cannot render chart: no tasks available');
      return;
    }
    
    // Filter for main tasks (not done and no parent)
    const mainTasks = tasksToRender.filter(task => !task.done && !task.parent_id);
    console.log(`Rendering ${mainTasks.length} tasks on chart`);
    
    // Clear existing dots
    if (this.dotsGroup) {
      this.dotsGroup.innerHTML = '';
    } else {
      // Create dots group if it doesn't exist
      this.dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.dotsGroup.classList.add('task-dots');
      this.chartGroup.appendChild(this.dotsGroup);
    }
    
    // Track positions of each task dot for overlap detection
    const occupiedPositions = {};

    mainTasks.forEach(task => {
        const position = this.calculateTaskPosition(task);
        const dotSize = this.getTaskDotSize(task);
        
        // Create adjusted position object to handle overlaps
        let adjustedX = position.x;
        let adjustedY = position.y;
        
        // Generate a position key for overlap detection
        const posKey = `${Math.floor(position.x)},${Math.floor(position.y)}`;
        
        // Check for overlap and adjust position if necessary
        if (occupiedPositions[posKey]) {
            // Add a small random offset to both x and y coordinates
            adjustedX += (Math.random() * 10) - 5; // Random offset between -5 and 5
            adjustedY += (Math.random() * 10) - 5;
        }
        
        // Mark this position as occupied
        occupiedPositions[posKey] = true;
        
        // Create and position the dot with the adjusted coordinates
        const dot = this.createTaskDot(task, adjustedX, adjustedY, dotSize);
        
        // Add interaction behaviors
        this.addDotInteractions(dot, task);
        
        // Add to the dots group
        this.dotsGroup.appendChild(dot);
    });
  }
  
  addDotInteractions(dot, task) {
    // Get subtasks
    const subtasks = this.tasks ? this.tasks.filter(t => t.parent_id === task.id) : [];
    
    // Create tooltip content
    const tooltipContent = this.createTooltipContent(task, subtasks);
    
    // Mouse enter - show tooltip and enlarge dot
    dot.addEventListener('mouseenter', () => {
      // Enlarge the dot on hover
      const originalRadius = parseFloat(dot.getAttribute('r'));
      dot.setAttribute('r', originalRadius * 1.3);
      dot.setAttribute('stroke-width', '2');
      
      // Show tooltip
      this.showTooltip(tooltipContent, dot);
    });
    
    // Mouse leave - hide tooltip and restore dot size
    dot.addEventListener('mouseleave', () => {
      // Restore original size unless it's the selected dot
      if (!dot.classList.contains('selected-dot')) {
        dot.setAttribute('r', this.getTaskDotSize(task));
        dot.setAttribute('stroke-width', '1.5');
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
        const taskId = el.getAttribute('data-task-id');
        const relatedTask = this.tasks.find(t => t.id === parseInt(taskId));
        if (relatedTask) {
          el.setAttribute('r', this.getTaskDotSize(relatedTask));
        }
      });
      
      // Add selected class to this dot
      dot.classList.add('selected-dot');
      dot.setAttribute('r', parseFloat(this.getTaskDotSize(task)) * 1.3);
      dot.setAttribute('stroke-width', '2');
      
      // Show task details
      this.showTaskDetails(task);
      
      // Show a ripple effect
      this.showRippleEffect(dot);
      
      // Show notification
      this.showNotification('Selected task', `Focused on "${task.name || task.title}"`, 'info');
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
  
  getTaskDotSize(task) {
    // Base size - increased for better visibility in the larger chart
    let size = 8; // Increased from 6
    
    // Increase size based on task importance - more pronounced scaling
    size += task.importance * 0.6; // Increased factor from 0.5
    
    // Increase if it has subtasks - more pronounced scaling
    const subtaskCount = this.tasks.filter(t => t.parent_id === task.id).length;
    if (subtaskCount > 0) {
      size += Math.min(5, subtaskCount * 1.2); // Increased scaling factor
    }
    
    // Ensure minimum size for better visibility
    return Math.max(size, 10); // Set minimum size to 10
  }
  
  getQuadrantColorForTask(task) {
    // Determine quadrant based on importance and urgency
    const isImportant = task.importance > 5;
    const isUrgent = task.urgency > 5;
    
    let color;
    if (isImportant && isUrgent) {
      color = 'var(--q1-color, #ff5252)'; // Q1: Important & Urgent
    } else if (isImportant && !isUrgent) {
      color = 'var(--q2-color, #4caf50)'; // Q2: Important, Not Urgent
    } else if (!isImportant && isUrgent) {
      color = 'var(--q3-color, #ff9800)'; // Q3: Not Important, Urgent
    } else {
      color = 'var(--q4-color, #2196f3)'; // Q4: Not Important, Not Urgent
    }
    
    return color;
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
    
    // Position the tooltip above the dot
    const tooltipX = rect.left + rect.width / 2;
    const tooltipY = rect.top - 10;
    
    this.tooltipElement.style.left = `${tooltipX}px`;
    this.tooltipElement.style.top = `${tooltipY}px`;
    
    // Make tooltip visible after positioning
    setTimeout(() => {
      this.tooltipElement.classList.add('visible');
    }, 10);
  }
  
  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
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
      this.socket.emit('requestInitialData');
    } else if (this.socket) {
      // If not connected, wait for connection and then request data
      this.socket.on('connect', () => {
        this.socket.emit('requestInitialData');
      });
    }
    
    // Initialize chart if not already done
    if (!this.chartGroup) {
      this.initializeChart();
    }
    
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
    if (!this.chartWidth || !this.chartHeight) {
      console.warn('Chart dimensions not available, using defaults');
      this.chartWidth = 740;
      this.chartHeight = 520;
    }

    // For x-axis (urgency): Map urgency from 1-10 scale to chart width
    // For y-axis (importance): Map importance from 1-10 scale to chart height, but invert it
    // because in SVG, y=0 is at the top, and we want high importance at the top
    
    const x = (task.urgency / 10) * this.chartWidth;
    const y = this.chartHeight - (task.importance / 10) * this.chartHeight;
    
    return { x, y };
  }

  createTaskDot(task, x, y, dotSize) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("data-task-id", task.id);
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", dotSize);
    dot.setAttribute("fill", this.getQuadrantColorForTask(task));
    dot.classList.add("task-dot");
    return dot;
  }
}
