import { Request, Response, NextFunction } from 'express';
import * as movieService from '../services/movieService';

export const getPopularMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const results = await movieService.getPopularMovies();
        res.status(200).json({ results });
    } catch (error) {
        next(error);
    }
};

export const searchMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim() === '') {
            res.status(400).json({ error: 'Query parameter "q" is required and cannot be empty' });
            return;
        }

        const results = await movieService.searchMovies(q);
        res.status(200).json({ results });
    } catch (error) {
        next(error);
    }
};

export const getMovieById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || isNaN(Number(id))) {
            res.status(400).json({ error: 'Movie ID must be a valid number' });
            return;
        }

        const movie = await movieService.getMovieById(Number(id));
        res.status(200).json({ movie });
    } catch (error) {
        next(error);
    }
};
