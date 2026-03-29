import { Request, Response, NextFunction } from 'express';

export const getPopularMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getPopularMovies - Not implemented yet' });
    } catch (error) {
        next(error);
    }
};

export const searchMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'searchMovies - Not implemented yet' });
    } catch (error) {
        next(error);
    }
};

export const getMovie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getMovie - Not implemented yet', id: req.params.id });
    } catch (error) {
        next(error);
    }
};
