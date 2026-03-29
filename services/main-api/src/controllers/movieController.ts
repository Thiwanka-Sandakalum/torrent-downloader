import { Request, Response, NextFunction } from 'express';
<<<<<<< HEAD

export const getPopularMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getPopularMovies - Not implemented yet' });
=======
import * as movieService from '../services/movieService';

export const getPopularMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const results = await movieService.getPopularMovies();
        res.status(200).json({ results });
>>>>>>> copilot-worktree-2026-03-29T13-10-03
    } catch (error) {
        next(error);
    }
};

export const searchMovies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
<<<<<<< HEAD
        res.status(200).json({ message: 'searchMovies - Not implemented yet' });
=======
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim() === '') {
            res.status(400).json({ error: 'Query parameter "q" is required and cannot be empty' });
            return;
        }

        const results = await movieService.searchMovies(q);
        res.status(200).json({ results });
>>>>>>> copilot-worktree-2026-03-29T13-10-03
    } catch (error) {
        next(error);
    }
};

<<<<<<< HEAD
export const getMovie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.status(200).json({ message: 'getMovie - Not implemented yet', id: req.params.id });
=======
export const getMovieById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || isNaN(Number(id))) {
            res.status(400).json({ error: 'Movie ID must be a valid number' });
            return;
        }

        const movie = await movieService.getMovieById(Number(id));
        res.status(200).json({ movie });
>>>>>>> copilot-worktree-2026-03-29T13-10-03
    } catch (error) {
        next(error);
    }
};
