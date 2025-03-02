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
        server.listen(port, async () => {
            console.log(`Server started on port ${port}`);
            
            // Use child_process instead of the open package
            if (process.env.NODE_ENV !== 'production') {
                const { exec } = await import('child_process');
                const url = `http://localhost:${port}`;
                console.log(`Opening browser at ${url}`);
                
                // Determine the command based on the operating system
                let command;
                switch (process.platform) {
                    case 'darwin':  // macOS
                        command = `open "${url}"`;
                        break;
                    case 'win32':   // Windows
                        command = `start "" "${url}"`;
                        break;
                    default:        // Linux and others
                        command = `xdg-open "${url}"`;
                        break;
                }
                
                // Execute the command and handle errors
                exec(command, (error) => {
                    if (error) {
                        console.error('Error opening browser:', error);
                    }
                });
            }
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