
import { Request, Response, NextFunction } from 'express';

<<<<<<< HEAD
export const validateRequestSchema = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  const errors: string[] = [];
  
  if (req.headers.authorization?.startsWith('Bearer ') !== true) {
    errors.push('Invalid authorization header');
  }

  if (errors.length) {
    res.status(400).json({ errors });
=======
const MAGNET_REGEX = /^magnet:\?xt=urn:btih:/i;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateMagnetLink = (req: Request, res: Response, next: NextFunction): void => {
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
>>>>>>> copilot-worktree-2026-03-29T13-10-03
    return;
  }

  next();
};
<<<<<<< HEAD
=======

export const validateTaskId = (req: Request, res: Response, next: NextFunction): void => {
  const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;

  if (!taskId || !UUID_V4_REGEX.test(taskId)) {
    res.status(400).json({ error: 'Invalid task ID format' });
    return;
  }

  next();
};

>>>>>>> copilot-worktree-2026-03-29T13-10-03
