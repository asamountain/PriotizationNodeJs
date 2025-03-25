import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import Task from './models/Task.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",  // Allow all origins
    methods: ["GET", "POST"],
    credentials: true
  },
  // Force polling transport only for Vercel compatibility
  transports: ['polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  path: '/socket.io/'
});

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
}

// Connection cache for serverless environment
let cachedDb = null;

// Connect to MongoDB with connection caching for serverless
const connectToDatabase = async () => {
  if (cachedDb) {
    console.log('Using cached database connection');
    return cachedDb;
  }

  try {
    const db = await mongoose.connect(MONGODB_URI, {
      // These options help with connection stability
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedDb = db;
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Root route handler
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('👤 New client connected');
  
  try {
    // Make sure we have a database connection
    await connectToDatabase();
    
    // Fetch tasks from MongoDB using imported Task model
    const tasks = await Task.find({})
      .sort({ 
        importance: -1,  // Sort by importance in descending order
        urgency: -1,     // Then by urgency in descending order
        createdAt: -1    // Finally by creation date
      });
    console.log(`📤 Sending ${tasks.length} tasks to client`);
    
    socket.emit('initialData', { 
      data: tasks,
      dataSource: 'MongoDB',
      timestamp: new Date().toISOString()
    });
    
    // Handle new task creation
    socket.on('addTask', async (taskData, callback) => {
      try {
        // Ensure database connection
        await connectToDatabase();
        
        const newTask = new Task({
          ...taskData,
          createdAt: new Date()
        });
        
        await newTask.save();
        console.log('✨ New task saved:', newTask._id);
        
        // Send to all clients including sender
        io.emit('taskAdded', newTask);
        
        // Send success response to sender
        if (typeof callback === 'function') {
          callback({ success: true, task: newTask });
        }
      } catch (error) {
        console.error('❌ Error adding task:', error);
        
        // Send error to sender
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        } else {
          socket.emit('error', { message: 'Failed to add task' });
        }
      }
    });
    
    // Handle task updates
    socket.on('updateTask', async ({ taskId, updates }, callback) => {
      try {
        // Ensure database connection
        await connectToDatabase();
        
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          { ...updates, updatedAt: new Date() },
          { new: true }
        );
        
        if (!updatedTask) {
          throw new Error('Task not found');
        }
        
        console.log('📝 Task updated:', taskId);
        
        // Send to all clients
        io.emit('taskUpdated', updatedTask);
        
        // Send success response to sender
        if (typeof callback === 'function') {
          callback({ success: true, task: updatedTask });
        }
      } catch (error) {
        console.error('❌ Error updating task:', error);
        
        // Send error to sender
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        } else {
          socket.emit('error', { message: 'Failed to update task' });
        }
      }
    });
    
    // Handle task deletion
    socket.on('deleteTask', async (taskId, callback) => {
      try {
        // Ensure database connection
        await connectToDatabase();
        
        await Task.findByIdAndDelete(taskId);
        console.log('🗑️ Task deleted:', taskId);
        
        // Send to all clients
        io.emit('taskDeleted', { _id: taskId });
        
        // Send success response to sender
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        console.error('❌ Error deleting task:', error);
        
        // Send error to sender
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        } else {
          socket.emit('error', { message: 'Failed to delete task' });
        }
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('👤 Client disconnected');
    });
    
  } catch (error) {
    console.error('❌ Socket error:', error);
    socket.emit('error', { message: 'Server error' });
  }
});

// Server startup for local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async () => {
    // Connect to database
    await connectToDatabase();
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
  });
}

// Export for serverless environment
export default server;