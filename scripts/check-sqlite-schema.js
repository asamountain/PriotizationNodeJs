const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database
const dbPath = path.join(__dirname, '..', 'tasks.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Get table info
db.all(`PRAGMA table_info(tasks)`, (err, columns) => {
  if (err) {
    console.error('Error getting table info:', err);
    return;
  }
  
  console.log('SQLite Table Schema:');
  console.table(columns);
  
  // Get sample data
  db.all(`SELECT * FROM tasks LIMIT 3`, (err, rows) => {
    if (err) {
      console.error('Error getting sample data:', err);
      return;
    }
    
    console.log('\nSample Data:');
    console.table(rows);
    
    // Close the database
    db.close();
  });
}); 