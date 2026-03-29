import 'dotenv/config';
import { createServer } from './src/config/server';
import { connectRedis } from './src/services/redisService';
import { logger } from './src/config/logger';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectRedis();
    logger.info('Redis connected');

    const app = createServer();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
