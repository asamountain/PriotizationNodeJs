import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import logger from './logger';

// Create database connection
const db = new sqlite3.Database('./tasks.db', (err) => {
    if (err) {
        logger.error('Database connection error:', err);
    }
    logger.info('Connected to database');
});

// Initialize database table
const initDatabase = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    db.run(sql, (err) => {
        if (err) {
            logger.error('Table creation error:', err);
        }
    });
};

// Get all tasks
const getTaskData = (callback) => {
    const sql = `
        SELECT * FROM tasks 
        ORDER BY 
            CASE priority
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
            END,
            created_at DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error('Error fetching tasks:', err);
            callback([]);
            return;
        }
        callback(rows);
    });
};

// Add new task
const addTask = (task, callback) => {
    const sql = `
        INSERT INTO tasks (name, priority) 
        VALUES (?, ?)
    `;
    
    db.run(sql, [task.name, task.priority], function(err) {
        if (err) {
            logger.error('Error adding task:', err);
            callback(false);
            return;
        }
        logger.info('Task added:', this.lastID);
        callback(true);
    });
};

// Modify existing task
const modifyTask = (task, callback) => {
    const sql = `
        UPDATE tasks 
        SET name = ?, 
            priority = ?,
            status = ?
        WHERE id = ?
    `;
    
    db.run(sql, [task.name, task.priority, task.status, task.id], (err) => {
        if (err) {
            logger.error('Error modifying task:', err);
            callback(false);
            return;
        }
        logger.info('Task modified:', task.id);
        callback(true);
    });
};

// Delete task
const deleteTask = (id, callback) => {
    const sql = 'DELETE FROM tasks WHERE id = ?';
    
    db.run(sql, [id], (err) => {
        if (err) {
            logger.error('Error deleting task:', err);
            callback(false);
            return;
        }
        logger.info('Task deleted:', id);
        callback(true);
    });
};

// Initialize database on module load
initDatabase();

export { getTaskData, addTask, modifyTask, deleteTask };

