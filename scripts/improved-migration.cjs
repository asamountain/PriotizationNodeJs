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

// MongoDB connection string - try multiple environment variables
let uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  // Hardcode a URI for testing if environment variable isn't set
  console.error('No MongoDB URI found in environment. Please set MONGODB_URI in your .env file');
  process.exit(1);
}

// Field mapping based on your actual SQLite schema
const fieldMapping = {
  'id': 'originalId',       // Store original SQLite ID, but let MongoDB create its own _id
  'name': 'title',          // Rename to more standard field name
  'importance': 'importance',
  'urgency': 'urgency',
  'done': 'completed',      // Rename to more standard field name
  'created_at': 'createdAt', // Convert to camelCase
  'parent_id': 'parentId',   // Convert to camelCase
  'due_date': 'dueDate',     // Convert to camelCase
  'link': 'link',
  'completed_at': 'completedAt', // Convert to camelCase
  'notes': 'notes'
};

async function migrateToMongoDB() {
  // Path to your SQLite database
  const dbPath = path.join(__dirname, '..', 'tasks.db');
  
  // Connect to SQLite
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error connecting to SQLite database:', err);
      process.exit(1);
    }
    console.log(`Connected to SQLite database at ${dbPath}`);
  });
  
  // Connect to MongoDB
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db();
    const collection = database.collection('tasks');
    
    // Check if there are already tasks in MongoDB
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`Warning: MongoDB collection already has ${existingCount} tasks`);
      console.log('Do you want to continue and potentially create duplicates? (y/n)');
      
      // Simple way to get user input synchronously
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('> ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Migration aborted');
        return;
      }
    }
    
    // Get all tasks from SQLite
    const tasks = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM tasks', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${tasks.length} tasks in SQLite database`);
    
    if (tasks.length === 0) {
      console.log('No tasks to migrate');
      return;
    }
    
    // Transform SQLite tasks to MongoDB format
    const transformedTasks = tasks.map(task => {
      const mongoTask = {};
      
      // Map fields using our mapping
      Object.entries(task).forEach(([sqliteField, value]) => {
        const mongoField = fieldMapping[sqliteField];
        
        if (mongoField) {
          // Handle type conversions and special fields
          switch(sqliteField) {
            case 'id':
              // Store original ID as a string
              mongoTask[mongoField] = value.toString();
              break;
              
            case 'done':
              // Convert to boolean
              mongoTask[mongoField] = value === 1 || value === true || value === 'true';
              break;
              
            case 'importance':
            case 'urgency':
              // Ensure these are numbers
              mongoTask[mongoField] = typeof value === 'number' ? value : parseInt(value) || 0;
              break;
              
            case 'created_at':
            case 'completed_at':
            case 'due_date':
              // Convert to Date objects if present
              if (value) {
                try {
                  mongoTask[mongoField] = new Date(value);
                } catch (e) {
                  console.warn(`Could not parse date for task ${task.id}, field ${sqliteField}: ${value}`);
                  // If we can't parse, leave as is
                  mongoTask[mongoField] = value;
                }
              }
              break;
              
            case 'parent_id':
              // Convert to string if present
              mongoTask[mongoField] = value !== null ? value.toString() : null;
              break;
              
            default:
              // Default handling
              mongoTask[mongoField] = value;
          }
        }
      });
      
      // Add standard MongoDB timestamps
      if (!mongoTask.createdAt) {
        mongoTask.createdAt = new Date();
      }
      mongoTask.updatedAt = new Date();
      
      return mongoTask;
    });
    
    // Log a sample of what we're about to insert
    console.log('Sample transformed task:');
    console.log(JSON.stringify(transformedTasks[0], null, 2));
    
    // Insert transformed tasks into MongoDB
    const result = await collection.insertMany(transformedTasks);
    console.log(`Successfully migrated ${result.insertedCount} tasks to MongoDB`);
    
    // Create indexes for better performance
    await collection.createIndex({ title: 1 });
    await collection.createIndex({ completed: 1 });
    await collection.createIndex({ parentId: 1 });
    await collection.createIndex({ importance: -1, urgency: -1 });
    console.log('Created indexes for faster queries');
    
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