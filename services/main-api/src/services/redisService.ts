import { createClient, RedisClientType } from 'redis';
import { logger } from '../config/logger';

let client: RedisClientType;

export const connectRedis = async (): Promise<RedisClientType> => {
    if (client) return client;

    client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' }) as RedisClientType;

    client.on('error', (err: any) => logger.error('Redis client error', err));
    client.on('connect', () => logger.info('Redis connected'));

    await client.connect();
    return client;
};

export const getRedisClient = (): RedisClientType => {
    if (!client) throw new Error('Redis not initialised — call connectRedis() first');
    return client;
};

// ─── Stream helpers ────────────────────────────────────────────────────────────

export const enqueueDownload = async (payload: {
    taskId: string;
    userId: string;
    magnetLink: string;
}): Promise<void> => {
    await client.xAdd('download_queue', '*', payload as Record<string, string>);
};

// ─── Cache helpers ─────────────────────────────────────────────────────────────

export const cacheGet = async (key: string): Promise<string | null> => {
    return client.get(key);
};

export const cacheSet = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
    await client.set(key, value, { EX: ttlSeconds });
};

export const cacheDel = async (key: string): Promise<void> => {
    await client.del(key);
};
