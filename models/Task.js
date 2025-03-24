import mongoose from 'mongoose';

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
    required: true,
    trim: true
  },
  
  // Priority fields
  importance: {
    type: Number,
    default: 5
  },
  urgency: {
    type: Number,
    default: 5
  },
  
  // Status fields
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  
  // Relationship fields
  parentId: String,
  
  // Additional info
  dueDate: Date,
  link: String,
  notes: String,
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

const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
export default Task; 