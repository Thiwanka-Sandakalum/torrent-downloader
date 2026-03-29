import { apiClient } from './api';

export type TaskStatus = 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed' | 'cancelled';

export interface Task {
    taskId: string;
    status: TaskStatus;
    progress: number;
    speed?: string;
    eta?: number;
    driveFileId?: string;
    errorMessage?: string | null;
    createdAt: string;
    completedAt?: string | null;
}

export interface ProgressEvent {
    type?: 'ping';
    taskId?: string;
    status?: TaskStatus;
    progress?: number;
    speed?: string;
    eta?: number;
    driveFileId?: string;
    reason?: string;
}

export const createTask = async (magnetLink: string): Promise<{ taskId: string }> => {
    const { data } = await apiClient.post<{ taskId: string }>('/tasks', { magnetLink });
    return data;
};

export const listTasks = async (): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>('/tasks');
    return data;
};

export const getTask = async (taskId: string): Promise<Task> => {
    const { data } = await apiClient.get<Task>(`/tasks/${taskId}`);
    return data;
};

export const cancelTask = async (taskId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
};

/**
 * Opens an SSE connection to the task progress stream.
 * Returns a cleanup function — call it to close the connection.
 */
export const subscribeToProgress = (
    taskId: string,
    onEvent: (event: ProgressEvent) => void,
    onError?: (err: Event) => void,
): (() => void) => {
    const url = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/tasks/${taskId}/progress`;
    const source = new EventSource(url);

    source.onmessage = (e) => {
        try {
            onEvent(JSON.parse(e.data) as ProgressEvent);
        } catch {
            // non-JSON heartbeat — ignore
        }
    };

    if (onError) source.onerror = onError;

    return () => source.close();
};
