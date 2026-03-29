import express from 'express';
<<<<<<< HEAD
import { downloadMovie, getDownloadedMovies, deleteDownloadedMovies, getDownloadedMovie, deleteDownloadedMovie } from '../controllers';

const router = express.Router();

router.post('/download', downloadMovie);
router.get('/downloads', getDownloadedMovies);
router.delete('/downloads', deleteDownloadedMovies);
router.get('/downloads/:id', getDownloadedMovie);
router.delete('/downloads/:id', deleteDownloadedMovie);

export default router;
=======
import { auth0Middleware } from '../middlewares';
import { createTask, listTasks, getTask, getTaskProgress, cancelTask } from '../controllers/taskController';

const router = express.Router();

router.post('/', auth0Middleware, createTask);
router.get('/', auth0Middleware, listTasks);
router.get('/:taskId', auth0Middleware, getTask);
router.get('/:taskId/progress', auth0Middleware, getTaskProgress);
router.delete('/:taskId', auth0Middleware, cancelTask);

export default router;

>>>>>>> copilot-worktree-2026-03-29T13-10-03
