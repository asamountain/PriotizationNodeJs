import { getTaskData, addTask, modifyTask, deleteTask, toggleTaskDone } from "./db.js";
import logger from "./logger.js";

const setupSocket = (io) => {
  // Process tasks to ensure numeric values
  const processTaskData = (tasks) => {
    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      importance: Number(task.importance) || 0,
      urgency: Number(task.urgency) || 0,
      done: Boolean(task.done),
      created_at: task.created_at,
    }));
  };
  io.on("connection", (socket) => {
    logger.info("New client connected", null, "socket.js");

    // Send initial data with processed numeric values
    getTaskData()
      .then((data) => {
        const processedData = processTaskData(data);
        logger.info(
          "Initial data fetched",
          { count: processedData.length },
          "socket.js"
        );
        socket.emit("initialData", { data: processedData });
      })
      .catch((error) => {
        logger.error("Failed to fetch initial data", error, "socket.js");
        socket.emit("initialData", { data: [] });
      });

    socket.on("addTask", async (task) => {
      try {
        logger.info("Adding task", task, "socket.js");
        const taskId = await addTask(task);
        logger.info("Task added successfully", { id: taskId }, "socket.js");

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        logger.error("Failed to add task", error, "socket.js");
      }
    });

    socket.on("modifyTask", async (task) => {
      try {
        logger.info("Modifying task", task, "socket.js");
        await modifyTask(task);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        logger.error("Failed to modify task", error, "socket.js");
      }
    });

    socket.on("deleteTask", async (id) => {
      try {
        logger.info(`Deleting task with ID: ${id}`, null, "socket.js");
        await deleteTask(id);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        logger.error("Failed to delete task", error, "socket.js");
      }
    });

    socket.on("updateTasks", async (task) => {
      try {
        const data = await getTaskData();
        const processedData = processTaskData(data);
        io.emit("updateTasks", { data: processedData });
      } catch (error) {
        logger.error("Failed to update tasks", error, "socket.js");
      }
    });

    socket.on("toggleDone", async (id) => {
      try {
        logger.info(`Toggling done status for task with ID: ${id}`, null, "socket.js");
        await toggleTaskDone(id);

        const data = await getTaskData();
        io.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        logger.error("Failed to toggle task done status", error, "socket.js");
      }
    });

    socket.on("disconnect", () => {
      logger.info("Client disconnected", null, "socket.js");
    });
  });
};

export default setupSocket;
