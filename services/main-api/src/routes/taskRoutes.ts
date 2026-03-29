import express from 'express';
import { auth0Middleware } from '../middlewares';
import { createTask, listTasks, getTask, getTaskProgress, cancelTask } from '../controllers/taskController';

const router = express.Router();

router.post('/', auth0Middleware, createTask);
router.get('/', auth0Middleware, listTasks);
router.get('/:taskId', auth0Middleware, getTask);
router.get('/:taskId/progress', auth0Middleware, getTaskProgress);
router.delete('/:taskId', auth0Middleware, cancelTask);

export default router;

