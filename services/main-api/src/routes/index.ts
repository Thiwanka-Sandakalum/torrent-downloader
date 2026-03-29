<<<<<<< HEAD
export { default as movieRoutes } from './movieRoutes';
export { default as taskRoutes } from './taskRoutes';
export { default as driveRoutes } from './driveRoutes';
=======
import express from 'express';
import movieRoutes from './movieRoutes';
import taskRoutes from './taskRoutes';
import driveRoutes from './driveRoutes';

const router = express.Router();

router.use('/movies', movieRoutes);
router.use('/tasks', taskRoutes);
router.use('/drive', driveRoutes);

export default router;

>>>>>>> copilot-worktree-2026-03-29T13-10-03
