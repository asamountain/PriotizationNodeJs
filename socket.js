import { getTaskData, addTask, modifyTask, deleteTask, toggleTaskDone, editTask } from "./db.js";
import database from "./db.js";

const setupSocket = (io) => {
  // Process tasks to ensure numeric values
  const processTaskData = (tasks) => {
    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      importance: Number(task.importance) || 0,
      urgency: Number(task.urgency) || 0,
      done: task.done === 1 || task.done === true || task.done === "true",
      created_at: task.created_at,
      parent_id: task.parent_id
    }));
  };
  io.on("connection", (socket) => {
    console.log("New client connected");

    // Send initial data with processed numeric values
    getTaskData()
      .then((data) => {
        const processedData = processTaskData(data);
        console.log("Initial data fetched:", processedData.length, "items");
        console.log("Sample data:", processedData.slice(0, 2));
        socket.emit("initialData", { data: processedData });
      })
      .catch((error) => {
        console.error("Failed to fetch initial data:", error);
        socket.emit("initialData", { data: [] });
      });

    socket.on("addTask", async (task) => {
      try {
        console.log("Adding task:", task);
        const taskId = await addTask(task);
        console.log("Task added successfully, ID:", taskId);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to add task:", error);
      }
    });

    socket.on("modifyTask", async (task) => {
      try {
        console.log("Modifying task:", task);
        await modifyTask(task);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to modify task:", error);
      }
    });

    socket.on("deleteTask", async (id) => {
      try {
        console.log("Deleting task with ID:", id);
        await deleteTask(id);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    });

    socket.on("updateTasks", async (task) => {
      try {
        const data = await getTaskData();
        const processedData = processTaskData(data);
        io.emit("updateTasks", { data: processedData });
      } catch (error) {
        console.error("Failed to update tasks:", error);
      }
    });

    socket.on("toggleDone", async (id) => {
      try {
        console.log("Toggling done status for task with ID:", id);
        await toggleTaskDone(id);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to toggle task done status:", error);
      }
    });

    socket.on("addSubtask", async ({ subtask, parentId }) => {
      try {
        console.log("Adding subtask:", subtask, "to parent:", parentId);
        const subtaskId = await database.addSubtask(subtask, parentId);
        console.log("Subtask added successfully, ID:", subtaskId);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to add subtask:", error);
      }
    });

    socket.on("updateSubtask", async ({ subtask }) => {
      try {
        console.log("Updating subtask:", subtask);
        await database.updateSubtask(subtask);
        console.log("Subtask updated successfully");

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to update subtask:", error);
      }
    });

    socket.on("editTask", async (task) => {
      try {
        console.log("Editing task:", task);
        await editTask(task);
        console.log("Task edited successfully");

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to edit task:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
};

export default setupSocket;
