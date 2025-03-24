const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

dotenv.config();
if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

async function verifyMigration() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MongoDB URI found in environment');
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
    console.log('\nSample MongoDB tasks:');
    console.log(JSON.stringify(tasks, null, 2));
    
    // Run some aggregate queries to check data integrity
    const completedCount = await collection.countDocuments({ completed: true });
    console.log(`\nCompleted tasks: ${completedCount}`);
    
    const highPriorityCount = await collection.countDocuments({ 
      importance: { $gt: 7 }, 
      urgency: { $gt: 7 }
    });
    console.log(`High priority tasks (importance & urgency > 7): ${highPriorityCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

verifyMigration()
  .then(() => console.log('Verification complete'))
  .catch(error => console.error('Verification failed:', error)); 