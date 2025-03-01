import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase } from "./db.js";
import setupSocket from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express setup
const app = express();
const server = createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

// Setup socket connection
setupSocket(io);

// Routes
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
});

// Server initialization
const startServer = async (port = 3000) => {
    try {
        await initDatabase();
        server.listen(port, () => {
            console.log(`Server started on port ${port}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

// Handle port conflicts
const findAvailablePort = (startPort) => {
    return new Promise((resolve) => {
        const server = createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on("error", () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
};

// Start server with dynamic port
findAvailablePort(3000)
    .then(port => startServer(port))
    .catch(error => {
        console.error("Port finding failed:", error);
        process.exit(1);
    });

// Error handling
process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});