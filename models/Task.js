const mongoose = require('mongoose');

// Adjust field names and types based on your actual data
const TaskSchema = new mongoose.Schema({
  // Store original SQLite ID (for reference)
  originalId: {
    type: String,
    index: true
  },
  
  // Main task fields
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  
  // Priority fields
  importance: {
    type: Number,
    default: 5,
    min: 0,
    max: 10
  },
  urgency: {
    type: Number,
    default: 5,
    min: 0,
    max: 10
  },
  
  // Status fields
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  
  // Relationship fields
  parentId: {
    type: String,
    default: null,
    index: true
  },
  
  // Additional info
  dueDate: {
    type: Date,
    default: null
  },
  link: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true }, // Include virtuals when converting to JSON
  toObject: { virtuals: true }
});

// Calculate priority score (derived field)
TaskSchema.virtual('priorityScore').get(function() {
  return (this.importance * this.urgency) / 10;
});

// Check if task is overdue
TaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && !this.completed;
});

// Prevent NextJS from creating multiple models during hot-reload
module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema); 