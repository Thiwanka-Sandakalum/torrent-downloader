import 'dotenv/config';
import mongoose from 'mongoose';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis, getRedisClient } from './services/redisService';
import { createApp } from './config/server';

const PORT = process.env.PORT || 3000;

let server: any;

const bootstrap = async () => {
    try {
        logger.info('Starting server...');

        await connectDatabase();
        await connectRedis();

        const app = createApp();

        server = app.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT}`);
        });

    } catch (error) {
        logger.fatal(error, 'Failed to start server');
        process.exit(1);
    }
};

const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    if (server) {
        server.close(() => {
            logger.info('HTTP server closed');
        });
    }

    try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');

        const redisClient = getRedisClient();
        await redisClient.quit();
        logger.info('Redis disconnected');
    } catch (error) {
        logger.error(error, 'Error during shutdown');
    }

    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap();

