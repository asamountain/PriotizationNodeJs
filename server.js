import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase } from "./db.js";
import setupSocket from "./socket.js";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express setup
const app = express();
const server = createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static("public"));
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
            logger.info("Server started", { port }, "server.js");
        });
    } catch (error) {
        logger.error("Server startup failed", error, "server.js");
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
        logger.error("Port finding failed", error, "server.js");
        process.exit(1);
    });

// Error handling
process.on("unhandledRejection", (error) => {
    logger.error("Unhandled Rejection", error, "server.js");
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", error, "server.js");
    process.exit(1);
});

