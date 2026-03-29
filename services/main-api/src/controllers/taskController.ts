import { Request, Response, NextFunction } from 'express';
<<<<<<< HEAD

export const downloadMovie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'downloadMovie - Not implemented yet' });
    } catch (error) {
        next(error);
    }
};

export const getDownloadedMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getDownloadedMovies - Not implemented yet' });
    } catch (error) {
        next(error);
    }
};

export const deleteDownloadedMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getDownloadedMovie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getDownloadedMovie - Not implemented yet', id: req.params.id });
    } catch (error) {
        next(error);
    }
};

export const deleteDownloadedMovie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(204).send();
    } catch (error) {
        next(error);
    }
=======
import { TaskModel } from '../models/taskModel';
import * as taskService from '../services/taskService';
import * as sseService from '../services/sseService';
import { AppError } from '../types';

const MAGNET_REGEX = /^magnet:\?xt=urn:btih:/i;

export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.auth as any)?.payload?.sub;
    const { magnetLink } = req.body;

    if (!magnetLink || typeof magnetLink !== 'string') {
      res.status(400).json({ error: 'magnetLink is required' });
      return;
    }

    if (!MAGNET_REGEX.test(magnetLink)) {
      res.status(400).json({ error: 'Invalid magnet link format' });
      return;
    }

    if (magnetLink.length > 1024) {
      res.status(400).json({ error: 'magnetLink must not exceed 1024 characters' });
      return;
    }

    const task = await taskService.createTask({ userId, magnetLink });
    await TaskModel.create({
      taskId: task.taskId,
      userId,
      magnetLink,
      status: 'queued',
    });

    res.status(201).json({ taskId: task.taskId });
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.auth as any)?.payload?.sub;

    const tasks = await TaskModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ tasks });
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const userId = (req.auth as any)?.payload?.sub;

    const task = await TaskModel.findOne({ taskId }).lean();

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
};

export const getTaskProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const userId = (req.auth as any)?.payload?.sub;

    const task = await TaskModel.findOne({ taskId }).lean();

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const snapshot = await taskService.getTaskSnapshot(taskId);

    if (task.status === 'complete' || task.status === 'failed') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const snapshotData = snapshot ? JSON.parse(snapshot) : task;
      res.write(`data: ${JSON.stringify(snapshotData)}\n\n`);
      res.end();
      return;
    }

    await sseService.streamTaskProgress(taskId, res);
  } catch (error) {
    next(error);
  }
};

export const cancelTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const userId = (req.auth as any)?.payload?.sub;

    const task = await TaskModel.findOne({ taskId });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (task.status === 'uploading' || task.status === 'complete') {
      res.status(409).json({ error: 'Cannot cancel task in current state' });
      return;
    }

    await taskService.cancelTask(taskId);
    await TaskModel.updateOne({ taskId }, { status: 'cancelled' });

    res.status(200).json({ cancelled: true });
  } catch (error) {
    next(error);
  }
>>>>>>> copilot-worktree-2026-03-29T13-10-03
};
