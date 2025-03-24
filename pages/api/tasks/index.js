import dbConnect from '../../../lib/mongodb';
import Task from '../../../models/Task';

export default async function handler(req, res) {
  const { method } = req;
  
  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const { userId } = req.query;
        
        if (!userId) {
          return res.status(400).json({ success: false, error: 'UserId is required' });
        }
        
        const tasks = await Task.find({ userId });
        return res.status(200).json({ success: true, data: tasks });
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    
    case 'POST':
      try {
        const task = await Task.create(req.body);
        return res.status(201).json({ success: true, data: task });
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    
    default:
      return res.status(400).json({ success: false, error: 'Invalid method' });
  }
} 