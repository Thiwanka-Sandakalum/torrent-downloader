import express from 'express';
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

    return app;
};
