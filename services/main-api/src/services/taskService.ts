import { v4 as uuidv4 } from 'uuid';
import { getRedisClient, enqueueDownload } from './redisService';
import { logger } from '../config/logger';

export interface CreateTaskInput {
    userId: string;
    magnetLink: string;
}

export interface Task {
    taskId: string;
    userId: string;
    magnetLink: string;
    status: 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed' | 'cancelled';
    progress: number;
    speed?: string;
    eta?: number;
    storagePath?: string;
    driveFileId?: string;
    errorMessage?: string | null;
    createdAt: string;
    completedAt?: string | null;
}

// ─── Task creation ─────────────────────────────────────────────────────────────

export const createTask = async (input: CreateTaskInput): Promise<Task> => {
    const taskId = uuidv4();
    const task: Task = {
        taskId,
        userId: input.userId,
        magnetLink: input.magnetLink,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
    };

    // Enqueue on Redis Stream first — if this fails, we return 503 without writing to DB
    await enqueueDownload({ taskId, userId: input.userId, magnetLink: input.magnetLink });

    logger.info({ taskId, userId: input.userId }, 'Task enqueued');
    return task;
};

// ─── Task cancellation ─────────────────────────────────────────────────────────

export const cancelTask = async (taskId: string): Promise<void> => {
    const redis = getRedisClient();
    await redis.publish(`task:${taskId}:control`, 'cancel');
    logger.info({ taskId }, 'Cancel signal published');
};

// ─── Snapshot (last known progress for late SSE subscribers) ──────────────────

export const getTaskSnapshot = async (taskId: string): Promise<string | null> => {
    const redis = getRedisClient();
    return redis.get(`task:${taskId}:snapshot`);
};
