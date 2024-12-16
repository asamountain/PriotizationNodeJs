const socket = io();
import { TaskManager } from "./taskManager.js";
const taskManager = new TaskManager(socket);
window.taskManager = taskManager; // Make it globally accessible
window.socket = socket;

// Then add your global handlers
window.handleModifyTask = (taskId) => {
  taskManager.modifyTask(taskId);
};

window.handleDeleteTask = (taskId) => {
  taskManager.deleteTask(taskId);
};

window.updateNumericValue = (slider, valueId) => {
  const displayElement = document.getElementById(valueId);
  if (displayElement) {
    displayElement.textContent = slider.value;
  }
};
window.addTask = () => {
  const taskName = document.getElementById("taskName").value;
  const importance = document.getElementById("importance").value;
  const urgency = document.getElementById("urgency").value;

  if (!taskName) return;

  socket.emit("addTask", {
    name: taskName,
    importance: parseFloat(importance),
    urgency: parseFloat(urgency),
  });
};
