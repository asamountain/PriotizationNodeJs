import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { networkInterfaces } from 'os';
import detect from 'detect-port';
import open from 'open';
import Task from './models/Task.js';  // Import Task model

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Get local IP address
const getLocalIP = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

// Find available port
const findAvailablePort = async (startPort) => {
  try {
    const port = await detect(startPort);
    return port;
  } catch (err) {
    console.error('Error finding available port:', err);
    return startPort;
  }
};

// Start server function
const startServer = async () => {
  try {
    // Connect to MongoDB first
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Serve static files
    app.use(express.static(join(__dirname, 'public')));

    // Socket.IO connection handling
    io.on('connection', async (socket) => {
      console.log('👤 New client connected');
      
      try {
        // Fetch tasks from MongoDB using imported Task model
        const tasks = await Task.find({}).sort({ createdAt: -1 });
        console.log(`📤 Sending ${tasks.length} tasks to client`);
        
        socket.emit('initialData', { 
          data: tasks,
          dataSource: 'MongoDB',
          timestamp: new Date().toISOString()
        });
        
        // Handle new task creation
        socket.on('addTask', async (taskData) => {
          try {
            const newTask = new Task({
              ...taskData,
              createdAt: new Date()
            });
            
            await newTask.save();
            console.log('✨ New task saved:', newTask._id);
            io.emit('taskAdded', newTask);
          } catch (error) {
            console.error('❌ Error adding task:', error);
            socket.emit('error', { message: 'Failed to add task' });
          }
        });
        
        // Handle task updates
        socket.on('updateTask', async ({ taskId, updates }) => {
          try {
            const updatedTask = await Task.findByIdAndUpdate(
              taskId,
              { ...updates, updatedAt: new Date() },
              { new: true }
            );
            
            if (!updatedTask) {
              throw new Error('Task not found');
            }
            
            console.log('📝 Task updated:', taskId);
            io.emit('taskUpdated', updatedTask);
          } catch (error) {
            console.error('❌ Error updating task:', error);
            socket.emit('error', { message: 'Failed to update task' });
          }
        });
        
        // Handle task deletion
        socket.on('deleteTask', async (taskId) => {
          try {
            await Task.findByIdAndDelete(taskId);
            console.log('🗑️ Task deleted:', taskId);
            io.emit('taskDeleted', { _id: taskId });
          } catch (error) {
            console.error('❌ Error deleting task:', error);
            socket.emit('error', { message: 'Failed to delete task' });
          }
        });
        
      } catch (error) {
        console.error('❌ Socket error:', error);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // Find available port
    const preferredPort = parseInt(process.env.PORT) || 3000;
    const port = await findAvailablePort(preferredPort);
    const localIP = getLocalIP();

    // Start the server
    server.listen(port, async () => {
      const localUrl = `http://localhost:${port}`;
      const networkUrl = `http://${localIP}:${port}`;
      
      console.log('\n🚀 Server is running!');
      console.log('-------------------');
      console.log(`📡 Local:   ${localUrl}`);
      console.log(`🌐 Network: ${networkUrl}`);
      console.log('-------------------\n');

      // Open browser automatically
      try {
        await open(localUrl);
        console.log('🌐 Browser opened automatically');
      } catch (err) {
        console.log('ℹ️ Could not open browser automatically');
        console.log('   Please open one of the URLs above manually');
      }
    });

  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

// Handle server errors
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('🔄 Server closed. Process terminating...');
    process.exit(0);
  });
});

// Start the server
startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});