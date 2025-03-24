import dbConnect from '../../../lib/mongodb';
import Task from '../../../models/Task';

export default async function handler(req, res) {
  console.log('🔍 API endpoint called: /api/tasks');
  
  try {
    console.log('⏳ Connecting to MongoDB...');
    await dbConnect();
    console.log('✅ MongoDB connected successfully');
    
    const tasks = await Task.find({});
    console.log(`📋 Retrieved ${tasks.length} tasks from MongoDB`);
    
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('❌ MongoDB error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
} 