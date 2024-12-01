const socket = io();

// Log connection status
socket.on("connect", () => {
  console.log("Connected to server");
});

// Handle initial data
socket.on("initialData", ({ data }) => {
  console.log("Received initial data:", data);
  renderTasks(data);
});

// Handle task updates
socket.on("updateTasks", ({ data }) => {
  console.log("Received task update:", data);
  renderTasks(data);
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

// Render tasks to DOM
function renderTasks(tasks) {
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className = `task-item ${task.priority}`;
    taskElement.innerHTML = `
            <span>${task.name}</span>
            <div class="task-controls">
                <span class="priority-badge">${task.priority}</span>
                <button onclick="deleteTask(${task.id})">Delete</button>
            </div>
        `;
    taskList.appendChild(taskElement);
  });
}
