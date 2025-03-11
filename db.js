import sqlite3 from "sqlite3";

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new sqlite3.Database("./tasks.db", (err) => {
          if (err) {
            console.error("Database connection failed:", err);
            reject(err);
            return;
          }
          console.log("Database connected successfully");
          this.createTables().then(resolve).catch(reject);
        });
      } catch (error) {
        console.error("Database initialization failed:", error);
        reject(error);
      }
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      // Define table creation and migrations in a single transaction
      const migrations = [
        `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          importance INTEGER DEFAULT 5,
          urgency INTEGER DEFAULT 5,
          done BOOLEAN DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          parent_id INTEGER NULL,
          FOREIGN KEY (parent_id) REFERENCES tasks(id)
        )`,
        // Add migrations for new columns
        `ALTER TABLE tasks ADD COLUMN due_date TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN link TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN completed_at TEXT NULL`
      ];
      
      this.db.serialize(() => {
        migrations.forEach(sql => {
          this.db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
              console.error("Migration failed:", err);
              reject(err);
              return;
            }
          });
        });
        resolve();
        console.log("Tables and migrations completed successfully");
      });
    });
  }

  // Your existing CRUD operations here
  async getTaskData() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM tasks ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC",
        [],
        (err, rows) => {
          if (err) {
            console.error("Error fetching tasks:", err);
            reject(err);
            return;
          }
          resolve(rows);
          console.log("Tasks fetched:", rows.length);
        }
      );
    });
  }

  async addTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, importance, urgency) VALUES (?, ?, ?)",
        [task.name, task.importance, task.urgency],
        function (err) {
          if (err) {
            console.error("Error adding task:", err);
            reject(err);
            return;
          }
          resolve(this.lastID);
          console.log("Task added:", this.lastID);
        }
      );
    });
  }

  async modifyTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, importance = ?, urgency = ? WHERE id = ?",
        [task.name, task.importance, task.urgency, task.id],
        (err) => {
          if (err) {
            console.error("Error modifying task:", err);
            reject(err);
            return;
          }
          resolve();
          console.log("Task modified:", task.id);
        }
      );
    });
  }
  async deleteTask(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM tasks WHERE id = ?", [id], (err) => {
        if (err) {
          console.error("Error deleting task:", err);
          reject(err);
          return;
        }
        resolve();
        console.log("Task deleted:", id);
      });
    });
  }

  async toggleTaskDone(id) {
    console.log('Database.toggleTaskDone called for task ID:', id);
    
    return new Promise((resolve, reject) => {
      // First, get the current task to determine its name for notification
      this.db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, task) => {
        if (err) {
          console.error("Error getting task for toggle:", err);
          reject(err);
          return;
        }
        
        if (!task) {
          const notFoundError = new Error(`Task with ID ${id} not found`);
          console.error(notFoundError);
          reject(notFoundError);
          return;
        }
        
        // Now that we have the task, update its done status
        // Also update completion_time for audit trail
        const now = new Date().toISOString();
        const updateQuery = task.done 
          ? "UPDATE tasks SET done = 0, completed_at = NULL WHERE id = ?" 
          : "UPDATE tasks SET done = 1, completed_at = ? WHERE id = ?";
        
        const params = task.done ? [id] : [now, id];
        
        this.db.run(updateQuery, params, (updateErr) => {
          if (updateErr) {
            console.error("Error toggling task done status:", updateErr);
            reject(updateErr);
            return;
          }
          
          // Task was successfully toggled
          console.log(`Task ${task.name} ${task.done ? 'reopened' : 'completed'}`);
          resolve(task);
        });
      });
    });
  }

  // Add a subtask to a parent task
  async addSubtask(subtask, parentId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, importance, urgency, parent_id, link, due_date) VALUES (?, ?, ?, ?, ?, ?)",
        [subtask.name, subtask.importance, subtask.urgency, parentId, subtask.link, subtask.due_date],
        function (err) {
          if (err) {
            console.error("Error adding subtask:", err);
            reject(err);
            return;
          }
          resolve(this.lastID);
          console.log("Subtask added:", this.lastID, "to parent:", parentId);
        }
      );
    });
  }

  async updateSubtask(subtask) {
    console.log("DATABASE: Updating subtask with ID:", subtask.id);
    console.log("DATABASE: Subtask link value being saved:", subtask.link);
    console.log("DATABASE: Subtask link type:", typeof subtask.link);
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error("Database connection not available");
        return reject(new Error("Database connection not available"));
      }
      
      try {
        this.db.run(
          "UPDATE tasks SET name = ?, importance = ?, urgency = ?, parent_id = ?, link = ?, due_date = ? WHERE id = ?",
          [subtask.name, subtask.importance, subtask.urgency, subtask.parent_id, subtask.link, subtask.due_date, subtask.id],
          function(err) {
            if (err) {
              console.error("Error updating subtask:", err);
              reject(err);
              return;
            }
            
            // Success - resolve with number of rows changed
            resolve(this.changes);
            console.log("Subtask updated successfully:", subtask.id, "Changes:", this.changes);
            console.log("Updated link value:", subtask.link);
          }
        );
      } catch (error) {
        console.error("Exception during subtask update:", error);
        reject(error);
      }
    });
  }

  async editTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, importance = ?, urgency = ?, link = ?, due_date = ? WHERE id = ?",
        [task.name, task.importance, task.urgency, task.link, task.due_date, task.id],
        function (err) {
          if (err) {
            console.error("Error editing task:", err);
            reject(err);
            return;
          }
          resolve(this.changes);
          console.log("Task edited:", task.id, "Changes:", this.changes);
        }
      );
    });
  }
}

const database = new Database();

// Add these exports back
export const getTaskData = (...args) => database.getTaskData(...args);
export const addTask = (...args) => database.addTask(...args);
export const modifyTask = (...args) => database.modifyTask(...args);
export const deleteTask = (...args) => database.deleteTask(...args);
export const toggleTaskDone = (...args) => database.toggleTaskDone(...args);
export const addSubtask = (...args) => database.addSubtask(...args);
export const updateSubtask = (...args) => database.updateSubtask(...args);
export const editTask = (...args) => database.editTask(...args);
export const initDatabase = async () => {
  try {
    await database.init();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
};

export default database;