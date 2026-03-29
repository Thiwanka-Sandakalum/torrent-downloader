import express from 'express';
import { getPopularMovies, searchMovies, getMovieById } from '../controllers/movieController';

const router = express.Router();

router.get('/', getPopularMovies);
router.get('/search', searchMovies);
router.get('/:id', getMovieById);

export default router;

