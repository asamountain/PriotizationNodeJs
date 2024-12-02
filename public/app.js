const socket = io();

// Log connection status
socket.on("connect", () => {
  console.log("Connected to server");
});

window.priorityChart = null;

function createPriorityMatrix(tasks) {
  const priorities = {
    high: { importance: 8, urgency: 8 },
    medium: { importance: 5, urgency: 5 },
    low: { importance: 2, urgency: 2 },
  };

  // Convert priority levels to numerical values
  const priorityData = tasks.map((task) => ({
    name: task.name,
    importance: priorities[task.priority].importance,
    urgency: priorities[task.priority].urgency,
  }));

  // Get window dimensions
  const width = window.innerWidth * 0.95; // 95% of window width
  const height = window.innerHeight * 0.8; // 80% of window height
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };

  // Clear existing content
  d3.select("#priorityChart").selectAll("*").remove();

  // Update SVG container size
  const svg = d3
    .select("#priorityChart")
    .attr("width", width)
    .attr("height", height)
    .style("display", "block")
    .style("margin", "0");

  // Add resize event listener
  window.addEventListener("resize", function () {
    const newWidth = window.innerWidth * 1;
    const newHeight = window.innerHeight * 1;

    svg.attr("width", newWidth).attr("height", newHeight);

    // Recalculate scales and redraw chart
    createPriorityMatrix(tasks);
  });

  // Create scales
  const xScale = d3
    .scaleLinear()
    .domain([0, 10])
    .range([margin.left, width - margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, 10])
    .range([height - margin.bottom, margin.top]);

  // Add quadrants
  const quadrants = [
    { x: 5, y: 5, width: 5, height: 5, color: "#ffcccc" },
    { x: 0, y: 5, width: 5, height: 5, color: "#cce6ff" },
    { x: 5, y: 0, width: 5, height: 5, color: "#ffe6cc" },
    { x: 0, y: 0, width: 5, height: 5, color: "#ccffcc" },
  ];

  // Add quadrant backgrounds
  svg
    .selectAll("rect")
    .data(quadrants)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.x))
    .attr("y", (d) => yScale(d.y + d.height))
    .attr("width", (d) => xScale(d.width) - margin.left)
    .attr("height", (d) => height - margin.bottom - yScale(d.height))
    .attr("fill", (d) => d.color)
    .attr("opacity", 0.3);

  // Add axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale));

  // Add tasks as points with labels
  const tasks_group = svg
    .selectAll(".task")
    .data(priorityData)
    .enter()
    .append("g")
    .attr("class", "task");

  tasks_group
    .append("circle")
    .attr("cx", (d) => xScale(d.importance))
    .attr("cy", (d) => yScale(d.urgency))
    .attr("r", 4)
    .attr("fill", "black");

  tasks_group
    .append("text")
    .attr("x", (d) => xScale(d.importance) + 5)
    .attr("y", (d) => yScale(d.urgency))
    .text((d) => d.name)
    .attr("font-size", "10px")
    .attr("alignment-baseline", "middle");
}
// Update socket event handlers
socket.on("initialData", ({ data }) => {
  console.log("Received initial data:", data);
  renderTasks(data);
  renderPriorityChart(data);
});
// Add these helper functions to calculate importance and urgency
function calculateImportance(task) {
  switch (task.priority) {
    case "high":
      return 8;
    case "medium":
      return 5;
    case "low":
      return 2;
    default:
      return 0;
  }
}

function calculateUrgency(task) {
  switch (task.priority) {
    case "high":
      return 8;
    case "medium":
      return 5;
    case "low":
      return 2;
    default:
      return 0;
  }
}

socket.on("updateTasks", ({ data }) => {
  const priorityData = data.map((task) => ({
    ...task,
    importance: calculateImportance(task), // Convert priority to 1-10 scale
    urgency: calculateUrgency(task), // Convert priority to 1-10 scale
  }));
  renderTasks(data);
  createPriorityMatrix(priorityData);
});

// Add new task
function addTask() {
  const taskName = document.getElementById("taskName").value;
  const priority = document.getElementById("priority").value;

  if (!taskName) return;

  socket.emit("addTask", {
    name: taskName,
    priority: priority,
  });

  document.getElementById("taskName").value = "";
}

// Modify existing task
function modifyTask(taskId) {
  const taskName = document.getElementById(`task-${taskId}-name`).value;
  const priority = document.getElementById(`task-${taskId}-priority`).value;

  socket.emit("modifyTask", {
    id: taskId,
    name: taskName,
    priority: priority,
  });
}

// Delete task
function deleteTask(taskId) {
  socket.emit("deleteTask", taskId);
}

// Render tasks
function renderTasks(tasks) {
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className = `task-item ${task.priority}`;
    taskElement.innerHTML = `
            <div class="task-content">
                <input type="text" value="${task.name}" id="task-${task.id}-name">
                <select id="task-${task.id}-priority">
                    <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
                    <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
                    <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
                </select>
                <button onclick="modifyTask(${task.id})">Update</button>
                <button onclick="deleteTask(${task.id})">Delete</button>
            </div>
        `;
    taskList.appendChild(taskElement);
  });
}
function renderPriorityChart(tasks) {
  createPriorityMatrix(tasks);
}
