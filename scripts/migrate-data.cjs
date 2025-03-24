const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const dns = require('dns');
const fs = require('fs');

// Add this near the top of your file
const dataDir = path.join(__dirname, '..', 'data');

// Create the data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  console.log(`Creating missing data directory: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Check which env file exists and load it
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env.development'),
  path.join(__dirname, '..', '.env.production')
];

let envFileFound = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
    envFileFound = true;
    break;
  }
}

if (!envFileFound) {
  console.warn('No .env files found. Creating one with a placeholder...');
  fs.writeFileSync(path.join(__dirname, '..', '.env'), 'MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.log('Created .env file with placeholder. Please edit it with your actual MongoDB URI.');
  process.exit(1);
}

// Now check if MONGODB_URI exists, if not, let's create it manually for this run
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not found in any .env file.');
  console.log('Enter your MongoDB connection string (or press Enter to abort):');
  
  // This is a synchronous way to get user input
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('MongoDB URI: ', (uri) => {
    if (!uri) {
      console.log('Aborted. Please add MONGODB_URI to your .env file and try again.');
      process.exit(1);
    }
    
    // Set the environment variable for this run
    process.env.MONGODB_URI = uri;
    
    // Also save it to .env for future use
    const envFile = fs.existsSync(path.join(__dirname, '..', '.env')) ? 
      path.join(__dirname, '..', '.env') : 
      path.join(__dirname, '..', '.env.local');
    
    fs.appendFileSync(envFile, `\nMONGODB_URI=${uri}`);
    console.log(`Added MONGODB_URI to ${envFile}`);
    
    readline.close();
    // Continue with migration
    migrateToMongoDB();
  });
} else {
  // If MONGODB_URI exists, proceed with migration
  migrateToMongoDB();
}

// Get tasks from SQLite database
async function getCurrentTasks() {
  try {
    // Start with expected path
    let dbPath = path.join(__dirname, '..', 'data', 'tasks.db');
    console.log(`Attempting to open SQLite database at: ${dbPath}`);
    
    // If not found, check root directory
    if (!fs.existsSync(dbPath)) {
      console.log(`SQLite database file not found at: ${dbPath}`);
      
      // Try the root directory instead (where it was actually found)
      const rootDbPath = path.join(__dirname, '..', 'tasks.db');
      if (fs.existsSync(rootDbPath)) {
        console.log(`Found database at: ${rootDbPath}`);
        dbPath = rootDbPath; // Use this path instead
      } else {
        console.error('Database file not found in root directory either.');
        return [];
      }
    }
    
    // Open the database (at the corrected path)
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Query all tasks from the database
    const tasks = await db.all('SELECT * FROM tasks');
    console.log(`Retrieved ${tasks.length} tasks from SQLite database`);
    
    // Close the database connection
    await db.close();
    
    return tasks;
  } catch (error) {
    console.error('Error reading from SQLite database:', error);
    return [];
  }
}

async function migrateToMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define MONGODB_URI in your .env file');
  }

  // Check if using placeholder value and warn user
  if (uri.includes('cluster0.mongodb.net')) {
    console.error('ERROR: You appear to be using a placeholder MongoDB connection string.');
    console.error('Please replace "cluster0.mongodb.net" with your actual MongoDB Atlas cluster URL.');
    console.error('Example: mongodb+srv://username:password@yourcluster.ab123.mongodb.net/yourdbname');
    process.exit(1); // Exit the script
  }

  // Add DNS error handling
  dns.setDefaultResultOrder('ipv4first'); // Help with DNS resolution

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  });
  
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Get database and collection
    const database = client.db('tasksapp'); // Choose your database name
    const collection = database.collection('tasks');
    
    // Get current tasks from SQLite
    const tasks = await getCurrentTasks();
    console.log(`Found ${tasks.length} tasks to migrate`);
    
    if (tasks.length === 0) {
      console.log('No tasks to migrate');
      return;
    }
    
    // Prepare tasks for MongoDB (add timestamps, ensure proper format)
    const preparedTasks = tasks.map(task => ({
      title: task.title || 'Untitled Task',
      description: task.description || '',
      completed: task.completed === 1 || task.completed === true || false,
      createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
      updatedAt: new Date(),
      userId: task.userId || 'legacy-user',
      // Map any other fields from your SQLite schema
    }));
    
    // Insert tasks into MongoDB
    const result = await collection.insertMany(preparedTasks);
    console.log(`${result.insertedCount} tasks successfully migrated to MongoDB`);
    
    // Optional: Create indexes for better performance
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ completed: 1 });
    console.log('Indexes created');
    
  } finally {
    // Close the connection
    await client.close();
    console.log('MongoDB connection closed');
  }
} 