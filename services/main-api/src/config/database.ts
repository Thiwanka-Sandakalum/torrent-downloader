import mongoose from 'mongoose';
import { logger } from './logger';

export const connectDatabase = async (): Promise<void> => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is not defined');
    }

    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 5000;

    while (attempts < maxAttempts) {
        try {
            await mongoose.connect(mongoUri);
            logger.info('MongoDB connected');

            mongoose.connection.on('error', (err) => {
                logger.error(err, 'MongoDB error');
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
            });

            return;
        } catch (error) {
            attempts++;
            logger.warn(`MongoDB connection attempt ${attempts} failed. Retrying in ${retryDelay / 1000}s...`);

            if (attempts >= maxAttempts) {
                throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts`);
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};
