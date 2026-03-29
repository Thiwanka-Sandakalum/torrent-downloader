import { Request, Response, NextFunction } from 'express';

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
};
