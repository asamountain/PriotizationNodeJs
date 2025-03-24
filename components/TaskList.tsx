import { useState, useEffect } from 'react';
import { ITask } from '../models/Task';

export default function TaskList({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        
        const result = await response.json();
        setTasks(result.data as ITask[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchTasks();
    }
  }, [userId]);

  if (loading) return <div>Loading tasks...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Your Tasks</h2>
      <ul>
        {tasks.map((task) => (
          <li key={task._id}>
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
            <p>Status: {task.completed ? 'Completed' : 'Pending'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
} 