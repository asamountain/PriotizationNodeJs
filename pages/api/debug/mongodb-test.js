import dbConnect from '../../../lib/mongodb';
import Task from '../../../models/Task';

export default async function handler(req, res) {
  // Force detailed logging
  console.log('=== MONGODB DEBUG TEST ===');
  
  try {
    console.log('1. Attempting MongoDB connection...');
    await dbConnect();
    console.log('2. MongoDB connection successful!');
    
    console.log('3. Testing database query...');
    const count = await Task.countDocuments();
    console.log(`4. Query success! Found ${count} documents`);
    
    return res.status(200).json({
      success: true,
      message: 'MongoDB connection verified',
      timestamp: new Date().toISOString(),
      documentCount: count
    });
  } catch (error) {
    console.error('MongoDB test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
} 