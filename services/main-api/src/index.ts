<<<<<<< HEAD
import express from './mainApi/node_modules/@types/express';
import bodyParser from './mainApi/node_modules/@types/body-parser';
import { getPopularMovies, searchMovies, getMovie, downloadMovie, getDownloadedMovies, deleteDownloadedMovies, getDownloadedMovie, deleteDownloadedMovie, streamMovie, checkStatus, cancelTask } from './controllers';

const app = express();
const port = process.env.PORT || 3000;
// const openApiDocument = YAML.load('/home/thiwa/Documents/projects/torrent-hunt/types/openApi.yaml');

app.use(bodyParser.json());
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Movies routes
app.get('/movies', getPopularMovies);
app.get('/movies/search', searchMovies);
app.get('/movies/:id', getMovie);

// Downloads routes
app.post('/movies/download', downloadMovie);
app.get('/movies/downloads', getDownloadedMovies);
app.delete('/movies/downloads', deleteDownloadedMovies);
app.get('/movies/downloads/:id', getDownloadedMovie);
app.delete('/movies/downloads/:id', deleteDownloadedMovie);

// Streaming route
app.get('/movies/stream/:id', streamMovie);

// Status routes
app.get('/status/:id', checkStatus);
app.post('/status/:id', cancelTask);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
=======
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

>>>>>>> copilot-worktree-2026-03-29T13-08-25
