import { useState, useEffect } from 'react';

export default function TaskList({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        
        const result = await response.json();
        setTasks(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [userId]);

  // Rest of your component...
} 