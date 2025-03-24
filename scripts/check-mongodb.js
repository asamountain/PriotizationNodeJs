const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Initialize dotenv
dotenv.config();

// Load .env.local if exists
if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

async function checkMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db();
    const collection = database.collection('tasks');
    
    // Count documents
    const count = await collection.countDocuments();
    console.log(`Found ${count} tasks in MongoDB`);
    
    // Get sample documents
    const tasks = await collection.find().limit(3).toArray();
    console.log('Sample MongoDB tasks:');
    console.log(JSON.stringify(tasks, null, 2));
    
    // Infer schema from documents
    if (tasks.length > 0) {
      const sampleTask = tasks[0];
      console.log('\nMongoDB Schema (inferred):');
      Object.keys(sampleTask).forEach(field => {
        const type = typeof sampleTask[field];
        console.log(`${field}: ${type === 'object' && sampleTask[field] instanceof Date ? 'Date' : type}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

checkMongoDB()
  .then(() => console.log('Check complete'))
  .catch(error => console.error('Check failed:', error)); 