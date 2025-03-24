import dbConnect from '../../../lib/mongodb';
import Task from '../../../models/Task';

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  await dbConnect();

  switch (method) {
    // Get a single task
    case 'GET':
      try {
        const task = await Task.findById(id);
        
        if (!task) {
          return res.status(404).json({ success: false, error: 'Task not found' });
        }
        
        return res.status(200).json({ success: true, data: task });
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    
    // Update a task
    case 'PUT':
      try {
        const updates = {
          ...req.body,
          updatedAt: new Date()
        };
        
        // If marking as completed, add completedAt date
        if (req.body.completed && !req.body.completedAt) {
          updates.completedAt = new Date();
        }
        
        // If marking as incomplete, remove completedAt
        if (req.body.completed === false) {
          updates.completedAt = null;
        }
        
        const task = await Task.findByIdAndUpdate(id, updates, {
          new: true,
          runValidators: true,
        });
        
        if (!task) {
          return res.status(404).json({ success: false, error: 'Task not found' });
        }
        
        return res.status(200).json({ success: true, data: task });
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    
    // Delete a task
    case 'DELETE':
      try {
        const deletedTask = await Task.deleteOne({ _id: id });
        
        if (deletedTask.deletedCount === 0) {
          return res.status(404).json({ success: false, error: 'Task not found' });
        }
        
        return res.status(200).json({ success: true, data: {} });
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
} 