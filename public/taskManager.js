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
      
      this.initializeSocket();
      this.initializeChart();
      this.initializeForm();
    } catch (error) {
      console.error('TaskManager constructor error:', error);
    }
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
      const width = 600;
      const height = 400;

      // Clear and create new SVG with explicit dimensions
      chartContainer.innerHTML = '';
      
      this.svg = d3.select('#priority-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('border', '1px solid #ccc');

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

      // Add axes
      this.chartGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(this.xScale));

      this.chartGroup.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(this.yScale));

      // Add axis labels
      this.svg.append('text')
        .attr('class', 'x-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .text('Urgency');

      this.svg.append('text')
        .attr('class', 'y-label')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${margin.left / 3}, ${height / 2}) rotate(-90)`)
        .text('Importance');

      // Add quadrant lines
      const midX = chartWidth / 2;
      const midY = chartHeight / 2;

      // Horizontal line
      this.chartGroup.append('line')
        .attr('x1', 0)
        .attr('y1', midY)
        .attr('x2', chartWidth)
        .attr('y2', midY)
        .attr('stroke', '#ccc')
        .attr('stroke-dasharray', '4');

      // Vertical line
      this.chartGroup.append('line')
        .attr('x1', midX)
        .attr('y1', 0)
        .attr('x2', midX)
        .attr('y2', chartHeight)
        .attr('stroke', '#ccc')
        .attr('stroke-dasharray', '4');

      // Add quadrant labels
      const labelOffset = 20;
      const fontSize = '12px';

      // Q1: Important & Urgent (Do First)
      this.chartGroup.append('text')
        .attr('x', chartWidth - labelOffset)
        .attr('y', labelOffset)
        .attr('text-anchor', 'end')
        .style('font-size', fontSize)
        .style('fill', '#d32f2f')
        .text('Do First');

      // Q2: Important & Not Urgent (Schedule)
      this.chartGroup.append('text')
        .attr('x', labelOffset)
        .attr('y', labelOffset)
        .style('font-size', fontSize)
        .style('fill', '#1976d2')
        .text('Schedule');

      // Q3: Not Important & Urgent (Delegate)
      this.chartGroup.append('text')
        .attr('x', chartWidth - labelOffset)
        .attr('y', chartHeight - labelOffset)
        .attr('text-anchor', 'end')
        .style('font-size', fontSize)
        .style('fill', '#ff9800')
        .text('Delegate');

      // Q4: Not Important & Not Urgent (Don't Do)
      this.chartGroup.append('text')
        .attr('x', labelOffset)
        .attr('y', chartHeight - labelOffset)
        .style('font-size', fontSize)
        .style('fill', '#757575')
        .text("Don't Do");

      // Create tooltip div
      this.tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    } catch (error) {
      console.error('Chart initialization error:', error);
    }
  }

  handleData(data) {
    if (!data || !Array.isArray(data.data)) return;
    try {
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
          <span class="task-name">${task.name}</span>
          <span class="task-importance">Importance: ${task.importance}</span>
          <span class="task-urgency">Urgency: ${task.urgency}</span>
          <button class="toggle-done" onclick="taskManager.toggleDone(${task.id})">
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

      // Add new circles with tooltips
      this.chartGroup.selectAll('circle')
        .data(tasks)
        .enter()
        .append('circle')
        .attr('cx', d => this.xScale(d.urgency))
        .attr('cy', d => this.yScale(d.importance))
        .attr('r', 6)
        .style('fill', d => {
          // Color based on quadrant
          if (d.importance >= 5 && d.urgency >= 5) return '#d32f2f';  // Do First
          if (d.importance >= 5 && d.urgency < 5) return '#1976d2';   // Schedule
          if (d.importance < 5 && d.urgency >= 5) return '#ff9800';   // Delegate
          return '#757575';  // Don't Do
        })
        .style('opacity', 0.6)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          this.tooltip.transition()
            .duration(200)
            .style('opacity', .9);
          this.tooltip.html(`
            <strong>${d.name}</strong><br/>
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
