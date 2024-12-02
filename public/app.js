const socket = io();

// Log connection status
socket.on("connect", () => {
  console.log("Connected to server");
});

window.priorityChart = null;

function createPriorityMatrix(tasks) {
  // Get window dimensions
  const width = window.innerWidth * 0.95;
  const height = window.innerHeight * 0.8;
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };

  // Clear existing content
  d3.select("#priorityChart").selectAll("*").remove();

  // Create SVG container
  const svg = d3
    .select("#priorityChart")
    .attr("width", width)
    .attr("height", height)
    .style("display", "block")
    .style("margin", "0");

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

  // Modify the simulation and connector code
  const simulation = d3
    .forceSimulation(tasks)
    .force("x", d3.forceX((d) => xScale(d.importance)).strength(0.1))
    .force("y", d3.forceY((d) => yScale(d.urgency)).strength(0.1))
    .force("collide", d3.forceCollide().radius(30))
    .on("tick", () => {
      // Ensure valid coordinates by clamping values
      labels
        .attr("x", (d) => xScale(d.importance) + 8)
        .attr("y", (d) =>
          Math.max(
            margin.top,
            Math.min(height - margin.bottom, d.y || yScale(d.urgency)),
          ),
        );

      connectors
        .attr("x1", (d) => xScale(d.importance))
        .attr("y1", (d) => yScale(d.urgency))
        .attr("x2", (d) => xScale(d.importance) + 8)
        .attr("y2", (d) =>
          Math.max(
            margin.top,
            Math.min(height - margin.bottom, d.y || yScale(d.urgency)),
          ),
        );
    });
  // Create task groups
  const taskGroups = svg
    .selectAll(".task")
    .data(tasks)
    .join("g")
    .attr("class", "task");

  // Add circles
  taskGroups
    .append("circle")
    .attr("cx", (d) => xScale(d.importance))
    .attr("cy", (d) => yScale(d.urgency))
    .attr("r", 4)
    .attr("fill", "black");

  // Add labels
  const labels = taskGroups
    .append("text")
    .attr("x", (d) => xScale(d.importance) + 8)
    .attr("y", (d) => yScale(d.urgency))
    .text((d) => d.name)
    .attr("font-size", "12px")
    .attr("alignment-baseline", "middle");

  // Add connecting lines
  const connectors = taskGroups
    .append("line")
    .attr("class", "connector")
    .attr("stroke", "#666")
    .attr("stroke-width", 0.5);

  // Add resize handler
  window.addEventListener("resize", () => {
    const newWidth = window.innerWidth * 0.95;
    const newHeight = window.innerHeight * 0.8;
    svg.attr("width", newWidth).attr("height", newHeight);
    createPriorityMatrix(tasks);
  });
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
// Modify the task structure in addTask function
function addTask() {
  const taskName = document.getElementById("taskName").value;
  const importance = document.getElementById("importance").value;
  const urgency = document.getElementById("urgency").value;

  if (!taskName) return;

  socket.emit("addTask", {
    name: taskName,
    importance: parseFloat(importance),
    urgency: parseFloat(urgency),
  });
}
const formHTML = `
<input type="text" id="taskName" placeholder="Task name">
<input type="range" id="importance" min="0" max="10" step="0.5" value="5">
<label for="importance">Importance: <span id="importanceValue">5</span>/10</label>
<input type="range" id="urgency" min="0" max="10" step="0.5" value="5">
<label for="urgency">Urgency: <span id="urgencyValue">5</span>/10</label>
<button onclick="addTask()">Add Task</button>
`;

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
