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

    console.log("Updating chart colors for theme change");

    // Update SVG background and border
    this.svg
        .style("background", "var(--background-primary)")
        .style("border", "1px solid var(--text-secondary)");

    // Update axes with new theme colors
    this.svg.selectAll(".x-axis text, .x-axis line, .x-axis path, .y-axis text, .y-axis line, .y-axis path")
        .style("color", "var(--text-secondary)");

    // Update axis labels
    this.svg.selectAll(".x-label, .y-label")
        .style("fill", "var(--text-primary)");

    // Update quadrant lines
    this.svg.selectAll("line")
        .style("stroke", "var(--text-secondary)");

    // Update quadrant labels
    const quadrantLabels = this.svg.selectAll("text");
    quadrantLabels.each(function(d, i) {
        const label = d3.select(this);
        if (label.text() === "Do First") label.style("fill", "var(--q1-color)");
        else if (label.text() === "Schedule") label.style("fill", "var(--q2-color)");
        else if (label.text() === "Delegate") label.style("fill", "var(--q3-color)");
        else if (label.text() === "Don't Do") label.style("fill", "var(--q4-color)");
    });

    // Update circles (task dots)
    this.svg.selectAll("circle")
        .style("fill", d => {
            if (d.importance >= 5 && d.urgency >= 5) return "var(--q1-color)";  // Do First
            if (d.importance >= 5 && d.urgency < 5) return "var(--q2-color)";   // Schedule
            if (d.importance < 5 && d.urgency >= 5) return "var(--q3-color)";   // Delegate
            return "var(--q4-color)";  // Don't Do
        });

    // Force a re-render of the chart
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
    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid data received:', data);
      return;
    }
    
    try {
      console.log('Received data:', data.data);
      
      // Store data for resize events
      this._lastData = data.data;
      
      // Call the Vue callback if it exists
      if (this.onTasksUpdate && typeof this.onTasksUpdate === 'function') {
        console.log('Calling Vue callback with data:', data.data.length, 'tasks');
        this.onTasksUpdate(data.data);
      } else {
        console.warn('Vue callback not available');
      }
      
      this.renderChart(data.data);
    } catch (error) {
      console.error('Data rendering error:', error);
    }
  }

  renderChart(tasks) {
    if (!this.chartGroup) return;

    try {
      // Clear existing circles
      this.chartGroup.selectAll('circle').remove();

      // Filter out done tasks and subtasks for the chart
      // Only main tasks are shown on the chart
      const activeTasks = tasks.filter(task => !task.done && task.parent_id === null);
      
      // Group tasks by their position to detect overlaps
      const taskPositions = {};
      activeTasks.forEach(task => {
        const key = `${task.importance}-${task.urgency}`;
        if (!taskPositions[key]) {
          taskPositions[key] = [];
        }
        taskPositions[key].push(task);
      });
      
      // Process each task with potential offset for overlaps
      const processedTasks = [];
      Object.values(taskPositions).forEach(tasksAtPosition => {
        if (tasksAtPosition.length === 1) {
          // No overlap, use exact position
          processedTasks.push({
            ...tasksAtPosition[0],
            offsetX: 0,
            offsetY: 0
          });
        } else {
          // Handle overlaps by creating a small cluster
          const clusterRadius = Math.min(5, 2 + tasksAtPosition.length);
          tasksAtPosition.forEach((task, i) => {
            // Calculate position in a circle around the actual point
            const angle = (i * (2 * Math.PI)) / tasksAtPosition.length;
            const offsetX = clusterRadius * Math.cos(angle);
            const offsetY = clusterRadius * Math.sin(angle);
            
            processedTasks.push({
              ...task,
              offsetX,
              offsetY
            });
          });
        }
      });
      
      // Add new circles with tooltips and offsets for overlapping points
      this.chartGroup.selectAll('circle')
        .data(processedTasks)
        .enter()
        .append('circle')
        .attr('cx', d => this.xScale(d.urgency) + d.offsetX)
        .attr('cy', d => this.yScale(d.importance) + d.offsetY)
        .attr('r', 6)
        .style('fill', d => {
          // Color based on quadrant using CSS variables
          if (d.importance >= 5 && d.urgency >= 5) return 'var(--q1-color)';  // Do First
          if (d.importance >= 5 && d.urgency < 5) return 'var(--q2-color)';   // Schedule
          if (d.importance < 5 && d.urgency >= 5) return 'var(--q3-color)';   // Delegate
          return 'var(--q4-color)';  // Don't Do
        })
        .style('opacity', 0.8)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          // Highlight this circle
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', 8)
            .style('opacity', 1)
            .style('stroke', 'var(--text-primary)')
            .style('stroke-width', 2);
          
          // Get subtasks for this task and order them by importance and urgency
          const subtasks = tasks
              .filter(task => task.parent_id === d.id)
              .sort((a, b) => {
                  // Order by importance first (descending)
                  if (b.importance !== a.importance) {
                      return b.importance - a.importance;
                  }
                  // Then by urgency (descending)
                  return b.urgency - a.urgency;
              });
          
          const subtasksHtml = subtasks.length > 0 
            ? `<div style="margin-top: 8px; border-top: 1px solid var(--text-secondary); padding-top: 5px;">
                <strong>Subtasks (${subtasks.length}):</strong>
                <ul style="margin: 5px 0; padding-left: 15px;">
                  ${subtasks.map(st => `<li>
                      ${st.name} 
                      <span style="font-size: 12px; color: var(--text-secondary);">
                        (I: ${st.importance}, U: ${st.urgency})
                      </span>
                      ${st.done ? ' ✓' : ''}
                    </li>`).join('')}
                </ul>
              </div>` 
            : '';
          
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
          
          // Show count of tasks at this position if there are overlaps
          const key = `${d.importance}-${d.urgency}`;
          const tasksAtPosition = taskPositions[key] || [];
          const overlapInfo = tasksAtPosition.length > 1 
            ? `<div style="margin-top: 5px; font-style: italic; color: var(--text-secondary)">
                (${tasksAtPosition.length} tasks at this position)
               </div>` 
            : '';
          
          this.tooltip.html(`
            <strong style="color: ${quadrantColor}">${d.name}</strong><br/>
            Importance: ${d.importance}<br/>
            Urgency: ${d.urgency}<br/>
            Category: ${this.getQuadrantName(d.importance, d.urgency)}
            ${overlapInfo}
            ${subtasksHtml}
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', (event) => {
          // Restore circle size
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', 6)
            .style('opacity', 0.8)
            .style('stroke', 'none');
          
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

  addSubtask(subtask, parentId) {
    console.log('TaskManager.addSubtask called with:', subtask, 'parentId:', parentId);
    this.socket.emit('addSubtask', { subtask, parentId });
  }

  updateSubtask(subtask) {
    console.log('TaskManager.updateSubtask called with:', subtask);
    this.socket.emit('updateSubtask', { subtask });
  }
}
