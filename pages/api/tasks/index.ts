import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../lib/mongodb';
import Task, { ITask } from '../../../models/Task';

// Define response types for safety
type ResponseData = {
  success: boolean;
  data?: ITask | ITask[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    // Connect to the database
    await connectToDatabase();
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        const tasks = await Task.find({ userId: req.query.userId as string });
        return res.status(200).json({ success: true, data: tasks });
        
      case 'POST':
        const task = new Task(req.body);
        const savedTask = await task.save();
        return res.status(201).json({ success: true, data: savedTask });
        
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
} 