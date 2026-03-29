
import { Request, Response, NextFunction } from 'express';

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
    return;
  }

  next();
};
