import express from 'express';
<<<<<<< HEAD
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { movieRoutes, taskRoutes, driveRoutes } from '../routes';
import { notFound, errorHandler } from '../middlewares';

export const createApp = (): express.Application => {
    const app = express();

    app.use(helmet());

    app.use(cors({
        origin: process.env.CLIENT_ORIGIN || '*',
        credentials: true
    }));

    app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev'));

    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true }));

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
    });
    app.use(limiter);

    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    app.use('/api/movies', movieRoutes);
    app.use('/api/tasks', taskRoutes);
    app.use('/api/drive', driveRoutes);

    app.use(notFound);
    app.use(errorHandler);
=======
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import router from '../routes';
import { errorMiddleware } from '../middlewares/errorMiddleware';

export const createServer = (): express.Application => {
    const app = express();

    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.use('/api', router);

    app.use(errorMiddleware);
>>>>>>> copilot-worktree-2026-03-29T13-10-03

    return app;
};
