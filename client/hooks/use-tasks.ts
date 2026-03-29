import { useEffect, useCallback } from 'react';
import { useTaskStore, Task } from '../store';
import {
  createTask as createTaskAPI,
  listTasks,
  cancelTask as cancelTaskAPI,
  subscribeToProgress,
  ProgressEvent,
} from '../services/tasks';

export function useTasks() {
  const { tasks, setTask, updateProgress } = useTaskStore();
  const unsubscribers = new Map<string, () => void>();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const loadedTasks = await listTasks();
        loadedTasks.forEach((task) => {
          const status: 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed' =
            task.status === 'cancelled' ? 'failed' : task.status as 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed';

          setTask({
            id: task.taskId,
            magnetUrl: '',
            status,
            createdAt: task.createdAt,
            progress: {
              status,
              progress: task.progress,
              speed: task.speed,
              eta: task.eta ? `${task.eta}s` : undefined,
              driveFileId: task.driveFileId,
            },
          });
        });
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    };

    loadTasks();
  }, [setTask]);

  const startSSE = useCallback((taskId: string) => {
    if (unsubscribers.has(taskId)) return;

    const unsubscribe = subscribeToProgress(
      taskId,
      (event: ProgressEvent) => {
        if (event.status && event.progress !== undefined) {
          const status: 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed' =
            event.status === 'cancelled' ? 'failed' : event.status as 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed';

          updateProgress(taskId, {
            status,
            progress: event.progress,
            speed: event.speed,
            eta: event.eta ? `${event.eta}s` : undefined,
            driveFileId: event.driveFileId,
          });
        }
      },
      (err) => {
        console.error(`SSE error for task ${taskId}:`, err);
        if (unsubscribers.has(taskId)) {
          unsubscribers.delete(taskId);
        }
      }
    );

    unsubscribers.set(taskId, unsubscribe);
  }, [updateProgress]);

  const createTask = useCallback(
    async (magnetUrl: string, movieId?: string) => {
      try {
        const result = await createTaskAPI(magnetUrl);
        const newTask: Task = {
          id: result.taskId,
          magnetUrl,
          movieId,
          status: 'queued',
          createdAt: new Date().toISOString(),
          progress: {
            status: 'queued',
            progress: 0,
          },
        };
        setTask(newTask);
        startSSE(result.taskId);
        return result.taskId;
      } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
      }
    },
    [setTask, startSSE]
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        await cancelTaskAPI(taskId);
        if (unsubscribers.has(taskId)) {
          unsubscribers.get(taskId)?.();
          unsubscribers.delete(taskId);
        }
        updateProgress(taskId, {
          status: 'failed',
          progress: 0,
        });
      } catch (error) {
        console.error('Failed to cancel task:', error);
        throw error;
      }
    },
    [updateProgress]
  );

  return { tasks, createTask, cancelTask, startSSE };
}
