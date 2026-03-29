import { Response } from 'express';
import { createClient } from 'redis';
import { logger } from '../config/logger';

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Opens an SSE connection, subscribes to task:${taskId}:progress on Redis Pub/Sub,
 * and pipes every published message to the HTTP response as a Server-Sent Event.
 *
 * Handles:
 *  - Heartbeat pings every 15 s to prevent proxy timeouts
 *  - Last-event snapshot for clients that connect after progress has already started
 *  - Clean unsubscribe + connection close on client disconnect
 */
export const streamTaskProgress = async (taskId: string, res: Response): Promise<void> => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Each SSE connection needs its own Redis subscriber client
    const subscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    await subscriber.connect();

    const send = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat to prevent Nginx / load-balancer timeout
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, HEARTBEAT_INTERVAL_MS);

    await subscriber.subscribe(`task:${taskId}:progress`, (message) => {
        try {
            send(JSON.parse(message));
        } catch {
            logger.warn({ taskId, message }, 'Failed to parse progress message');
        }
    });

    res.on('close', async () => {
        clearInterval(heartbeat);
        await subscriber.unsubscribe(`task:${taskId}:progress`);
        await subscriber.quit();
        logger.debug({ taskId }, 'SSE client disconnected');
    });
};
