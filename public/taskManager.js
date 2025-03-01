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
      
      // Add a callback property for Vue integration
      this.onTasksUpdate = null;
      this.vueApp = null;
      
      this.initializeSocket();
      this.initializeChart();
      this.initializeForm();
      
      // Add resize listener for responsive chart
      window.addEventListener('resize', this.handleResize.bind(this));
    } catch (error) {
      console.error('TaskManager constructor error:', error);
    }
  }

  // Set reference to Vue app for theme changes
  setVueApp(app) {
    this.vueApp = app;
  }

  // Update chart colors based on current theme
  updateChartColors() {
    if (!this.chartGroup) return;
    
    // Update SVG background and border
    if (this.svg) {
      this.svg
        .style('background', 'var(--background-primary)')
        .style('border', '1px solid var(--text-secondary)');
    }
    
    // Update axis colors
    d3.selectAll('.x-axis text, .x-axis line, .x-axis path, .y-axis text, .y-axis line, .y-axis path')
      .style('color', 'var(--text-secondary)');
    
    // Update axis labels
    d3.selectAll('.x-label, .y-label')
      .style('fill', 'var(--text-primary)');
    
    // Update quadrant lines
    this.chartGroup.selectAll('line')
      .attr('stroke', 'var(--text-secondary)');
    
    // Update quadrant labels
    const quadrantLabels = this.chartGroup.selectAll('text');
    quadrantLabels.each(function(d, i) {
      const label = d3.select(this);
      if (i === 0) label.style('fill', 'var(--q1-color)'); // Do First
      else if (i === 1) label.style('fill', 'var(--q2-color)'); // Schedule
      else if (i === 2) label.style('fill', 'var(--q3-color)'); // Delegate
      else if (i === 3) label.style('fill', 'var(--q4-color)'); // Don't Do
    });
    
    // Re-render with current data if available
    if (this._lastData) {
      this.renderChart(this._lastData);
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
    const chartContainer = document.querySelector('#priority-chart');
    if (!chartContainer) return;

    try {
      // Set explicit dimensions for the SVG
      const margin = { top: 40, right: 40, bottom: 60, left: 60 };
      // Get container width for responsive sizing
      const containerWidth = chartContainer.clientWidth || 800;
      const width = containerWidth - 40; // Account for padding
      const height = 400;

      // Clear and create new SVG with explicit dimensions
      chartContainer.innerHTML = '';
      
      this.svg = d3.select('#priority-chart')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('background', 'var(--background-primary)')
        .style('border', '1px solid var(--text-secondary)');

      this.chartGroup = this.svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      // Create scales
      this.xScale = d3.scaleLinear()
        .domain([0, 10])
        .range([0, chartWidth]);

      this.yScale = d3.scaleLinear()
        .domain([0, 10])
        .range([chartHeight, 0]);

      // Add axes with theme-aware colors
      this.chartGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(this.xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      this.chartGroup.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(this.yScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      // Add axis labels with theme-aware colors
      this.svg.append('text')
        .attr('class', 'x-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .style('fill', 'var(--text-primary)')
        .text('Urgency');

      this.svg.append('text')
        .attr('class', 'y-label')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${margin.left / 3}, ${height / 2}) rotate(-90)`)
        .style('fill', 'var(--text-primary)')
        .text('Importance');

      // Add quadrant lines with theme-aware colors
      const midX = chartWidth / 2;
      const midY = chartHeight / 2;

      // Horizontal line
      this.chartGroup.append('line')
        .attr('x1', 0)
        .attr('y1', midY)
        .attr('x2', chartWidth)
        .attr('y2', midY)
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-dasharray', '4');

      // Vertical line
      this.chartGroup.append('line')
        .attr('x1', midX)
        .attr('y1', 0)
        .attr('x2', midX)
        .attr('y2', chartHeight)
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-dasharray', '4');

      // Add quadrant labels with CSS variables
      const labelOffset = 20;
      const fontSize = '12px';

      // Q1: Important & Urgent (Do First)
      this.chartGroup.append('text')
        .attr('x', chartWidth - labelOffset)
        .attr('y', labelOffset)
        .attr('text-anchor', 'end')
        .style('font-size', fontSize)
        .style('fill', 'var(--q1-color)')
        .text('Do First');

      // Q2: Important & Not Urgent (Schedule)
      this.chartGroup.append('text')
        .attr('x', labelOffset)
        .attr('y', labelOffset)
        .style('font-size', fontSize)
        .style('fill', 'var(--q2-color)')
        .text('Schedule');

      // Q3: Not Important & Urgent (Delegate)
      this.chartGroup.append('text')
        .attr('x', chartWidth - labelOffset)
        .attr('y', chartHeight - labelOffset)
        .attr('text-anchor', 'end')
        .style('font-size', fontSize)
        .style('fill', 'var(--q3-color)')
        .text('Delegate');

      // Q4: Not Important & Not Urgent (Don't Do)
      this.chartGroup.append('text')
        .attr('x', labelOffset)
        .attr('y', chartHeight - labelOffset)
        .style('font-size', fontSize)
        .style('fill', 'var(--q4-color)')
        .text("Don't Do");

      // Create tooltip div with theme-aware styling
      d3.selectAll('.tooltip').remove(); // Remove any existing tooltips
      this.tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('background', 'var(--background-primary)')
        .style('color', 'var(--text-primary)')
        .style('border', '1px solid var(--text-secondary)');

    } catch (error) {
      console.error('Chart initialization error:', error);
    }
  }

  handleData(data) {
    if (!data || !Array.isArray(data.data)) return;
    try {
      // Store data for resize events
      this._lastData = data.data;
      
      // Call the Vue callback if it exists
      if (this.onTasksUpdate && typeof this.onTasksUpdate === 'function') {
        this.onTasksUpdate(data.data);
      }
      
      this.renderTaskList(data.data);
      this.renderChart(data.data);
    } catch (error) {
      console.error('Data rendering error:', error);
    }
  }

  renderTaskList(tasks) {
    if (!this.taskList) return;

    try {
      this.taskList.innerHTML = tasks.map(task => `
        <div class="task" data-id="${task.id}">
          <div class="task-info">
            <span class="task-name">${task.name}</span>
            <div class="task-metrics">
              <span>Importance: ${task.importance}</span>
              <span>Urgency: ${task.urgency}</span>
              ${task.done ? '<span class="task-done">✓ Completed</span>' : ''}
            </div>
          </div>
          <button 
            class="toggle-done ${task.done ? 'done' : ''}"
            onclick="taskManager.toggleDone(${task.id})"
          >
            ${task.done ? 'Undo' : 'Done'}
          </button>
        </div>
      `).join('');
    } catch (error) {
      console.error('Task list rendering error:', error);
    }
  }

  renderChart(tasks) {
    if (!this.chartGroup) return;

    try {
      // Clear existing circles
      this.chartGroup.selectAll('circle').remove();

      // Filter out done tasks for the chart
      const activeTasks = tasks.filter(task => !task.done);
      
      // Add new circles with tooltips
      this.chartGroup.selectAll('circle')
        .data(activeTasks)
        .enter()
        .append('circle')
        .attr('cx', d => this.xScale(d.urgency))
        .attr('cy', d => this.yScale(d.importance))
        .attr('r', 6)
        .style('fill', d => {
          // Color based on quadrant using CSS variables
          if (d.importance >= 5 && d.urgency >= 5) return 'var(--q1-color)';  // Do First
          if (d.importance >= 5 && d.urgency < 5) return 'var(--q2-color)';   // Schedule
          if (d.importance < 5 && d.urgency >= 5) return 'var(--q3-color)';   // Delegate
          return 'var(--q4-color)';  // Don't Do
        })
        .style('opacity', 0.6)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          this.tooltip.transition()
            .duration(200)
            .style('opacity', .9)
            .style('background', 'var(--background-primary)')
            .style('color', 'var(--text-primary)')
            .style('border', '1px solid var(--text-secondary)');
          
          // Get quadrant color based on importance and urgency
          let quadrantColor;
          if (d.importance >= 5 && d.urgency >= 5) quadrantColor = 'var(--q1-color)';
          else if (d.importance >= 5 && d.urgency < 5) quadrantColor = 'var(--q2-color)';
          else if (d.importance < 5 && d.urgency >= 5) quadrantColor = 'var(--q3-color)';
          else quadrantColor = 'var(--q4-color)';
          
          this.tooltip.html(`
            <strong style="color: ${quadrantColor}">${d.name}</strong><br/>
            Importance: ${d.importance}<br/>
            Urgency: ${d.urgency}<br/>
            Category: ${this.getQuadrantName(d.importance, d.urgency)}
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
          this.tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        });

    } catch (error) {
      console.error('Chart rendering error:', error);
    }
  }

  getQuadrantName(importance, urgency) {
    if (importance >= 5 && urgency >= 5) return 'Do First';
    if (importance >= 5 && urgency < 5) return 'Schedule';
    if (importance < 5 && urgency >= 5) return 'Delegate';
    return "Don't Do";
  }

  addTask() {
    const nameInput = document.getElementById('taskName');
    const importanceInput = document.getElementById('importance');
    const urgencyInput = document.getElementById('urgency');

    if (!nameInput || !importanceInput || !urgencyInput) return;

    const task = {
      name: nameInput.value,
      importance: parseFloat(importanceInput.value),
      urgency: parseFloat(urgencyInput.value)
    };

    if (!task.name) {
      alert('Please enter a task name');
      return;
    }

    this.socket.emit('addTask', task);

    // Clear form
    nameInput.value = '';
    importanceInput.value = '5';
    urgencyInput.value = '5';
    
    const importanceValue = document.getElementById('importanceValue');
    const urgencyValue = document.getElementById('urgencyValue');
    
    if (importanceValue) importanceValue.textContent = '5';
    if (urgencyValue) urgencyValue.textContent = '5';
  }

  toggleDone(taskId) {
    this.socket.emit('toggleDone', taskId);
  }
}
