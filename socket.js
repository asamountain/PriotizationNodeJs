import { getTaskData, addTask, modifyTask, deleteTask, toggleTaskDone, editTask, updateTaskNotes } from "./db.js";
import database from "./db.js";
import mongoose from 'mongoose';
import Task from './models/Task';
import socketIo from 'socket.io';

// MongoDB connection
async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

const setupSocket = (server) => {
  const io = socketIo(server);
  
  io.on('connection', async (socket) => {
    console.log('New client connected');
    
    try {
      // Connect to MongoDB (if not already connected)
      if (mongoose.connection.readyState !== 1) {
        await connectToMongoDB();
      }
      
      // Fetch tasks from MongoDB
      console.log('Fetching tasks from MongoDB...');
      const tasks = await Task.find({}).sort({ createdAt: -1 });
      console.log(`Sending ${tasks.length} tasks to client`);
      
      // Send tasks to the client
      socket.emit('initialData', { 
        data: tasks,
        dataSource: 'MongoDB',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching tasks from MongoDB:', error);
      socket.emit('error', { message: 'Failed to load tasks' });
    }
    
    // Handle new task creation
    socket.on('addTask', async (taskData) => {
      try {
        const newTask = new Task({
          ...taskData,
          createdAt: new Date()
        });
        
        await newTask.save();
        console.log('New task saved to MongoDB:', newTask._id);
        
        // Broadcast to all clients
        io.emit('taskAdded', newTask);
      } catch (error) {
        console.error('Error adding task to MongoDB:', error);
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
        
        console.log('Task updated in MongoDB:', taskId);
        io.emit('taskUpdated', updatedTask);
      } catch (error) {
        console.error('Error updating task in MongoDB:', error);
        socket.emit('error', { message: 'Failed to update task' });
      }
    });
    
    // Handle task deletion
    socket.on('deleteTask', async (taskId) => {
      try {
        await Task.findByIdAndDelete(taskId);
        console.log('Task deleted from MongoDB:', taskId);
        io.emit('taskDeleted', { _id: taskId });
      } catch (error) {
        console.error('Error deleting task from MongoDB:', error);
        socket.emit('error', { message: 'Failed to delete task' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  return io;
};

export default setupSocket;
