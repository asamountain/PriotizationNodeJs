import sqlite3 from "sqlite3";
import logger from "./logger.js";

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new sqlite3.Database("./tasks.db", (err) => {
          if (err) {
            logger.error("Database connection failed", err, "db.js");
            reject(err);
            return;
          }
          logger.info("Database connected successfully", null, "db.js");
          this.createTables().then(resolve).catch(reject);
        });
      } catch (error) {
        logger.error("Database initialization failed", error, "db.js");
        reject(error);
      }
    });
  }

  async createTables() {
    const migrations = [
      // Create table if it doesn't exist
      `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          importance REAL CHECK(importance >= 0 AND importance <= 10),
          urgency REAL CHECK(urgency >= 0 AND urgency <= 10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      // Add done column if it doesn't exist
      `ALTER TABLE tasks ADD COLUMN done INTEGER DEFAULT 0`
    ];

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        migrations.forEach(sql => {
          this.db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
              logger.error("Migration failed", err, "db.js");
              reject(err);
              return;
            }
          });
        });
        resolve();
        logger.info("Tables and migrations completed successfully", null, "db.js");
      });
    });
  }

  // Your existing CRUD operations here
  async getTaskData() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM tasks WHERE done = 0 ORDER BY importance DESC, urgency DESC",
        [],
        (err, rows) => {
          if (err) {
            logger.error("Error fetching tasks", err, "db.js");
            reject(err);
            return;
          }
          resolve(rows);
          logger.info("Tasks fetched:", rows.length, "db.js");
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
            logger.error("Error adding task", err, "db.js");
            reject(err);
            return;
          }
          resolve(this.lastID);
          logger.info("Task added:", this.lastID, "db.js");
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
            logger.error("Error modifying task", err, "db.js");
            reject(err);
            return;
          }
          resolve();
          logger.info("Task modified:", task.id, "db.js");
        }
      );
    });
  }
  async deleteTask(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM tasks WHERE id = ?", [id], (err) => {
        if (err) {
          logger.error("Error deleting task", err, "db.js");
          reject(err);
          return;
        }
        resolve();
        logger.info("Task deleted:", id, "db.js");
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
            logger.error("Error toggling task done status", err, "db.js");
            reject(err);
            return;
          }
          resolve();
          logger.info("Task done status toggled:", id, "db.js");
        }
      );
    });
  }
}

const database = new Database();

export const getTaskData = (...args) => database.getTaskData(...args);
export const addTask = (...args) => database.addTask(...args);
export const modifyTask = (...args) => database.modifyTask(...args);
export const deleteTask = (...args) => database.deleteTask(...args);
export const toggleTaskDone = (...args) => database.toggleTaskDone(...args);
export const initDatabase = async () => {
  try {
    await database.init();
    logger.info("Database initialized successfully", null, "db.js");
  } catch (error) {
    logger.error("Database initialization failed", error, "db.js");
    process.exit(1);
  }
};

export default database;
