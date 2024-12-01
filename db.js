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
    const sql = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                priority TEXT CHECK(priority IN ('high', 'medium', 'low')) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error("Table creation failed", err, "db.js");
          reject(err);
          return;
        }
        resolve();
        logger.info("Tables created successfully", null, "db.js");
      });
    });
  }

  // Your existing CRUD operations here
  async getTaskData() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM tasks ORDER BY created_at DESC",
        [],
        (err, rows) => {
          if (err) {
            logger.error("Error fetching tasks", err, "db.js");
            reject(err);
            return;
          }
          resolve(rows);
          logger.info("Tasks fetched:", rows.length, "db.js");
        },
      );
    });
  }

  async addTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, priority) VALUES (?, ?)",
        [task.name, task.priority],
        function (err) {
          if (err) {
            logger.error("Error adding task", err, "db.js");
            reject(err);
            return;
          }
          resolve(this.lastID);
          logger.info("Task added:", this.lastID, "db.js");
        },
      );
    });
  }

  async modifyTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, priority = ? WHERE id = ?",
        [task.name, task.priority, task.id],
        (err) => {
          if (err) {
            logger.error("Error modifying task", err, "db.js");
            reject(err);
            return;
          }
          resolve();
          logger.info("Task modified:", task.id, "db.js");
        },
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
}

const database = new Database();

export const getTaskData = (...args) => database.getTaskData(...args);
export const addTask = (...args) => database.addTask(...args);
export const modifyTask = (...args) => database.modifyTask(...args);
export const deleteTask = (...args) => database.deleteTask(...args);
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
