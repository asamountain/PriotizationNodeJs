// types/task.ts
export interface Task {
    id: number;
    name: string;
    importance: number;
    urgency: number;
    done: boolean;
    created_at: string;
  }