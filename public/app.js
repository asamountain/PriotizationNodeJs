const socket = io();
let tasks = [];

socket.on('initialData', ({ tasks: initialTasks }) => {
    tasks = initialTasks;
    renderTasks();
});

socket.on('updateTasks', ({ tasks: updatedTasks }) => {
    tasks = updatedTasks;
    renderTasks();
});

function addTask() {
    const taskName = document.getElementById('taskName').value;
    const priority = document.getElementById('priority').value;
    
    if (!taskName) return;
    
    socket.emit('addTask', {
        name: taskName,
        priority: priority
    });
    
    document.getElementById('taskName').value = '';
}

function deleteTask(taskId) {
    socket.emit('deleteTask', taskId);
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    tasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    }).forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item ${task.priority}`;
        taskElement.innerHTML = `
            <span>${task.name}</span>
            <div>
                <span class="priority-badge">${task.priority}</span>
                <button onclick="deleteTask(${task.id})">Delete</button>
            </div>
        `;
        taskList.appendChild(taskElement);
    });
}

