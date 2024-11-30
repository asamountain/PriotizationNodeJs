// db.js
import sqlite3 from "sqlite3";
import { promisify } from "util";

const db = new sqlite3.Database("tasks.db");

// Convert callback-based methods to Promise-based
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize database
const initDB = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            priority TEXT CHECK(priority IN ('high', 'medium', 'low')) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// Get all tasks
const getTaskData = async () => {
  try {
    const tasks = await dbAll(`
            SELECT * FROM tasks 
            ORDER BY 
                CASE priority 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                created_at DESC
        `);
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
};

// Add a new task
const addTask = async (task) => {
  try {
    await dbRun("INSERT INTO tasks (name, priority) VALUES (?, ?)", [
      task.name,
      task.priority,
    ]);
    return true;
  } catch (error) {
    console.error("Error adding task:", error);
    return false;
  }
};

// Modify existing task
const modifyTask = async (task) => {
  try {
    await dbRun("UPDATE tasks SET name = ?, priority = ? WHERE id = ?", [
      task.name,
      task.priority,
      task.id,
    ]);
    return true;
  } catch (error) {
    console.error("Error modifying task:", error);
    return false;
  }
};

// Delete a task
const deleteTask = async (id) => {
  try {
    await dbRun("DELETE FROM tasks WHERE id = ?", [id]);
    return true;
  } catch (error) {
    console.error("Error deleting task:", error);
    return false;
  }
};

// Initialize database on module load
initDB().catch(console.error);

export { getTaskData, addTask, modifyTask, deleteTask };
