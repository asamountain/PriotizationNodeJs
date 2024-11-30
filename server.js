import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import portfinder from "portfinder";

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static("public"));
app.use(express.json());

// In-memory storage (replace with database in production)
let tasks = [];

// Socket connection handling
io.on("connection", (socket) => {
  console.log("Client connected");

  // Send initial data
  socket.emit("initialData", { tasks });

  socket.on("addTask", (task) => {
    const newTask = {
      id: Date.now(),
      ...task,
      createdAt: new Date(),
    };
    tasks.push(newTask);
    io.emit("updateTasks", { tasks });
  });

  socket.on("modifyTask", (updatedTask) => {
    tasks = tasks.map((task) =>
      task.id === updatedTask.id ? updatedTask : task,
    );
    io.emit("updateTasks", { tasks });
  });

  socket.on("deleteTask", (taskId) => {
    tasks = tasks.filter((task) => task.id !== taskId);
    io.emit("updateTasks", { tasks });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

portfinder.getPort((err, PORT) => {
  if (err) {
    console.error("Port finding error:", err);
    return;
  }
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
