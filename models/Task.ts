import mongoose, { Schema, Document } from 'mongoose';

// Define interfaces for strong typing
export interface ITask extends Document {
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  userId: string;
}

const TaskSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  userId: { type: String, required: true, index: true }
}, { 
  timestamps: true 
});

// Prevent Mongoose model recompilation in development with hot reloading
export default mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema); 