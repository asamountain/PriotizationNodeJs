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
    const migrations = [
      // Create tasks table if it doesn't exist
      `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          importance REAL CHECK(importance >= 0 AND importance <= 10),
          urgency REAL CHECK(urgency >= 0 AND urgency <= 10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          done INTEGER DEFAULT 0,
          parent_id INTEGER DEFAULT NULL,
          FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
      )`,
      // Add done column if it doesn't exist
      `ALTER TABLE tasks ADD COLUMN done INTEGER DEFAULT 0`,
      // Add parent_id column if it doesn't exist
      `ALTER TABLE tasks ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES tasks(id) ON DELETE CASCADE`
    ];

    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET done = NOT done WHERE id = ?",
        [id],
        (err) => {
          if (err) {
            console.error("Error toggling task done status:", err);
            reject(err);
            return;
          }
          console.log("Task done status toggled:", id);
          resolve();
        }
      )
    })
  }

  // Add a subtask to a parent task
  async addSubtask(subtask, parentId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, importance, urgency, parent_id) VALUES (?, ?, ?, ?)",
        [subtask.name, subtask.importance, subtask.urgency, parentId],
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
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, importance = ?, urgency = ?, parent_id = ? WHERE id = ?",
        [subtask.name, subtask.importance, subtask.urgency, subtask.parent_id, subtask.id],
        function (err) {
          if (err) {
            console.error("Error updating subtask:", err);
            reject(err);
            return;
          }
          resolve(this.changes);
          console.log("Subtask updated:", subtask.id, "Changes:", this.changes);
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