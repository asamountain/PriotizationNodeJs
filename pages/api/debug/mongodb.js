import dbConnect from '../../../lib/mongodb';
import Task from '../../../models/Task';

export default async function handler(req, res) {
  try {
    // Test MongoDB connection
    await dbConnect();
    
    // Get sample data (limit to first 3 items)
    const sampleData = await Task.find().limit(3).lean();
    
    return res.status(200).json({
      connected: true,
      database: 'MongoDB',
      sampleData: sampleData.map(doc => ({
        ...doc,
        _id: doc._id.toString() // Convert ObjectId to string for JSON
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 