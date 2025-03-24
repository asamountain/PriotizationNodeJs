const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

dotenv.config();
if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

async function fixData() {
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
    
    // Example fix: rename fields
    /*
    const renameResult = await collection.updateMany(
      {}, // filter for all documents
      { $rename: { "old_field_name": "newFieldName" } }
    );
    console.log(`Renamed fields in ${renameResult.modifiedCount} documents`);
    */
    
    // Example fix: convert types
    /*
    const convertResult = await collection.updateMany(
      { completed: { $type: "string" } }, // find documents where completed is a string
      [{ $set: { completed: { $convert: { input: "$completed", to: "bool" } } } }]
    );
    console.log(`Converted types in ${convertResult.modifiedCount} documents`);
    */
    
    // Example fix: add missing fields
    /*
    const addFieldsResult = await collection.updateMany(
      { createdAt: { $exists: false } }, // find documents without createdAt
      { $set: { createdAt: new Date() } }
    );
    console.log(`Added missing fields to ${addFieldsResult.modifiedCount} documents`);
    */
    
    // Get sample of fixed data
    const tasks = await collection.find().limit(2).toArray();
    console.log('Sample data after fixes:');
    console.log(JSON.stringify(tasks, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

fixData()
  .then(() => console.log('Fix complete'))
  .catch(error => console.error('Fix failed:', error)); 