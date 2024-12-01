import { getTaskData, addTask, modifyTask, deleteTask } from "./db.js";
import logger from "./logger.js";

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    logger.info("New client connected", null, "socket.js");

    // Send initial data
    getTaskData()
      .then((data) => {
        logger.info(
          "Initial data fetched",
          { count: data.length },
          "socket.js",
        );
        socket.emit("initialData", { data });
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
        io.emit("updateTasks", { data });
      } catch (error) {
        logger.error("Failed to add task", error, "socket.js");
      }
    });

    socket.on("modifyTask", async (task) => {
      try {
        logger.info("Modifying task", task, "socket.js");
        await modifyTask(task);

        const data = await getTaskData();
        io.emit("updateTasks", { data });
      } catch (error) {
        logger.error("Failed to modify task", error, "socket.js");
      }
    });

    socket.on("deleteTask", async (id) => {
      try {
        logger.info(`Deleting task with ID: ${id}`, null, "socket.js");
        await deleteTask(id);

        const data = await getTaskData();
        io.emit("updateTasks", { data });
      } catch (error) {
        logger.error("Failed to delete task", error, "socket.js");
      }
    });

    socket.on("disconnect", () => {
      logger.info("Client disconnected", null, "socket.js");
    });
  });
};

export default setupSocket;
