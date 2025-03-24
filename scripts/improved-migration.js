const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Initialize dotenv
dotenv.config();

// Load .env.local if exists
if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

// MongoDB connection string
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Path to your SQLite database
const dbPath = path.join(__dirname, '..', 'tasks.db');

// Field mapping from SQLite to MongoDB
// Update these based on your actual SQLite schema!
const fieldMapping = {
  id: '_id',               // SQLite primary key → MongoDB _id
  title: 'title',          // Example mapping
  description: 'description',
  completed: 'completed',
  created_at: 'createdAt', // Different naming convention
  updated_at: 'updatedAt',
  user_id: 'userId'
  // Add more mappings based on your schema
};

async function migrateToMongoDB() {
  // Connect to MongoDB
  const client = new MongoClient(uri);
  
  // Connect to SQLite
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error connecting to SQLite database:', err);
      process.exit(1);
    }
    console.log('Connected to SQLite database');
  });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db();
    const collection = database.collection('tasks');
    
    // Get SQLite table structure first
    const getColumns = () => {
      return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(tasks)`, (err, columns) => {
          if (err) reject(err);
          else resolve(columns);
        });
      });
    };
    
    const columns = await getColumns();
    console.log('Found SQLite columns:', columns.map(col => col.name).join(', '));
    
    // Create a more accurate field mapping based on actual columns
    const dynamicMapping = {};
    columns.forEach(col => {
      // Try to find a match in our mapping, or use the original name
      dynamicMapping[col.name] = fieldMapping[col.name] || col.name;
    });
    
    console.log('Using field mapping:', dynamicMapping);
    
    // Get all tasks from SQLite
    const getTasks = () => {
      return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM tasks`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    const tasks = await getTasks();
    console.log(`Found ${tasks.length} tasks in SQLite`);
    
    if (tasks.length === 0) {
      console.log('No tasks to migrate');
      return;
    }
    
    // Transform SQLite tasks to MongoDB format
    const transformedTasks = tasks.map(task => {
      const mongoTask = {};
      
      // Map each field according to our mapping
      Object.keys(task).forEach(sqliteField => {
        const mongoField = dynamicMapping[sqliteField];
        
        if (mongoField) {
          // Handle special field transformations
          if (sqliteField === 'id') {
            // Don't map SQLite id to MongoDB _id (let MongoDB generate its own)
            // mongoTask._id = task[sqliteField].toString();
          } 
          else if (sqliteField === 'completed') {
            // Convert to boolean (SQLite might store as 0/1)
            mongoTask[mongoField] = task[sqliteField] === 1 || 
                                   task[sqliteField] === true || 
                                   task[sqliteField] === 'true';
          }
          else if (sqliteField.includes('_at') || sqliteField.includes('date')) {
            // Convert date strings to Date objects
            if (task[sqliteField]) {
              try {
                mongoTask[mongoField] = new Date(task[sqliteField]);
              } catch (e) {
                console.warn(`Could not parse date: ${task[sqliteField]}`);
                mongoTask[mongoField] = new Date();
              }
            } else {
              mongoTask[mongoField] = new Date();
            }
          }
          else {
            // Default mapping
            mongoTask[mongoField] = task[sqliteField];
          }
        }
      });
      
      // Ensure required fields exist
      if (!mongoTask.createdAt) mongoTask.createdAt = new Date();
      if (!mongoTask.updatedAt) mongoTask.updatedAt = new Date();
      
      return mongoTask;
    });
    
    // Log a sample transformed task
    console.log('Sample transformed task:', transformedTasks[0]);
    
    // Insert tasks into MongoDB
    const result = await collection.insertMany(transformedTasks);
    console.log(`${result.insertedCount} tasks successfully migrated to MongoDB`);
    
    // Create indexes
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ completed: 1 });
    console.log('Created indexes');
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    // Close connections
    await client.close();
    db.close();
    console.log('Connections closed');
  }
}

// Run migration
migrateToMongoDB()
  .then(() => console.log('Migration completed'))
  .catch(error => console.error('Migration failed:', error)); 