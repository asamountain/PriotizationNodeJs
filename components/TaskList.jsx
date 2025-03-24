import { useState, useEffect } from 'react';
import TaskService from '../services/taskService';

export default function TaskList({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('Loading...');

  useEffect(() => {
    if (!userId) return;
    
    async function fetchTasks() {
      console.log('⏳ Attempting to fetch tasks...');
      try {
        setLoading(true);
        const response = await fetch('/api/tasks?userId=test123');
        console.log('📨 Response received:', response.status, response.statusText);
        const data = await response.json();
        console.log('📦 Data received:', data);
        const fetchedTasks = await TaskService.getTasks(userId);
        
        // Check if data has MongoDB ObjectIDs
        const hasMongoId = fetchedTasks.length > 0 && 
                           fetchedTasks[0]._id && 
                           fetchedTasks[0]._id.length === 24;
        
        setDataSource(hasMongoId ? 'MongoDB' : 'Unknown Source');
        setTasks(fetchedTasks);
      } catch (error) {
        console.error('❌ Error fetching tasks:', error);
        setError(error.message || 'Failed to load tasks');
        setDataSource('Error');
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [userId]);

  const handleToggleComplete = async (id, currentStatus) => {
    try {
      const updatedTask = await TaskService.toggleTaskCompletion(id, !currentStatus);
      
      // Update local state
      setTasks(tasks.map(task => 
        task._id === id ? updatedTask : task
      ));
    } catch (err) {
      console.error('Error toggling task completion:', err);
      alert('Failed to update task: ' + err.message);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await TaskService.deleteTask(id);
      
      // Update local state
      setTasks(tasks.filter(task => task._id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task: ' + err.message);
    }
  };

  if (loading) return <div>Loading tasks...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (tasks.length === 0) return <div>No tasks found. Create your first task!</div>;

  return (
    <div className="task-list">
      <h2>Your Tasks ({tasks.length})</h2>
      <div className="data-source-indicator">
        Data Source: <span style={{ 
          color: dataSource === 'MongoDB' ? 'green' : 'red',
          fontWeight: 'bold'
        }}>
          {dataSource}
        </span>
      </div>
      <ul>
        {tasks.map(task => (
          <li key={task._id} className={task.completed ? 'completed' : ''}>
            <h3>{task.title}</h3>
            
            {task.description && <p>{task.description}</p>}
            
            <div className="task-meta">
              <div>
                Priority: {task.priorityScore.toFixed(1)}/10
                {task.isOverdue && <span className="overdue">Overdue!</span>}
              </div>
              
              <div className="task-actions">
                <button 
                  onClick={() => handleToggleComplete(task._id, task.completed)}
                >
                  {task.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
                
                <button 
                  onClick={() => handleDeleteTask(task._id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 