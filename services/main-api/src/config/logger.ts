<<<<<<< HEAD
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    } : undefined
});

export default logger;
export { logger };
=======
export const logger = {
    info: (message: any, meta?: any) => console.log(message, meta),
    error: (message: any, meta?: any) => console.error(message, meta),
    warn: (message: any, meta?: any) => console.warn(message, meta),
    debug: (message: any, meta?: any) => console.debug(message, meta),
};
>>>>>>> copilot-worktree-2026-03-29T13-10-03
