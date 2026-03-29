import express from 'express';
import movieRoutes from './movieRoutes';
import taskRoutes from './taskRoutes';
import driveRoutes from './driveRoutes';

const router = express.Router();

router.use('/movies', movieRoutes);
router.use('/tasks', taskRoutes);
router.use('/drive', driveRoutes);

export default router;

