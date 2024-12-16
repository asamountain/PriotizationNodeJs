import { PriorityChart } from "./chartClass.js";

export class TaskManager {
  constructor(socket) {
    this.socket = socket;
    this.chart = new PriorityChart("#priorityChart");
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on("connect", () => console.log("Connected to server"));
    this.socket.on("initialData", ({ data }) => this.handleData(data));
    this.socket.on("updateTasks", ({ data }) => this.handleData(data));
  }

  handleData(data) {
    if (!data) return;
    const processedData = this.processData(data);
    this.renderAll(processedData);
  }

  processData(tasks) {
    return tasks.map((task) => ({
      ...task,
      importance: Number(task.importance) || 0,
      urgency: Number(task.urgency) || 0,
    }));
  }

  renderAll(data) {
    this.renderTaskList(data);
    this.chart.render(data);
  }

  renderTaskList(tasks) {
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = tasks
      .map((task) => this.generateTaskHTML(task))
      .join("");
  }

  generateTaskHTML(task) {
    return `
      <div class="task-item">
        <div class="task-content">
          ${this.generateInputs(task)}
          ${this.generateButtons(task)}
        </div>
      </div>
    `;
  }

  generateInputs(task) {
    return `
      <input type="text" value="${task.name}" id="task-${task.id}-name">
      ${this.generateNumeric(task)}
    `;
  }

  generateNumeric(task) {
    return `
      <div class="slider-container">
        ${this.generateNumericGroup("importance", task)}
        ${this.generateNumericGroup("urgency", task)}
      </div>
    `;
  }

  generateNumericGroup(type, task) {
    return `
      <div class="numeric-group">
        <label>${type.charAt(0).toUpperCase() + type.slice(1)}: 
          <span id="task-${task.id}-${type}-value">${task[type]}</span>
        </label>
      <input 
          type="number" 
          id="task-${task.id}-${type}" 
          min="0" 
          max="10" 
          step="1" 
          value="${task[type]}"
          oninput="updateNumericValue(this, 'task-${task.id}-${type}-value')"
        >
      </div>
    `;
  }

  generateButtons(task) {
    return `
      <div class="button-group">
        <button onclick="taskManager.modifyTask(${task.id})">Update</button>
        <button onclick="taskManager.deleteTask(${task.id})">Delete</button>
      </div>
    `;
  }

  modifyTask(taskId) {
    const task = {
      id: taskId,
      name: document.getElementById(`task-${taskId}-name`).value,
      importance: parseFloat(
        document.getElementById(`task-${taskId}-importance`).value
      ),
      urgency: parseFloat(
        document.getElementById(`task-${taskId}-urgency`).value
      ),
    };
    socket.emit("modifyTask", task);
  }

  deleteTask(taskId) {
    socket.emit("deleteTask", taskId);
  }

  addTask() {
    const task = {
      name: document.getElementById("taskName").value,
      importance: parseFloat(document.getElementById("importance").value),
      urgency: parseFloat(document.getElementById("urgency").value),
    };

    if (!task.name) return;
    socket.emit("addTask", task);
  }
}
