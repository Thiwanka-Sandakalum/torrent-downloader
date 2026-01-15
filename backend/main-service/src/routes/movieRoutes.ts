import express from 'express';
import { getPopularMovies, searchMovies, getMovie } from '../controllers';

const router = express.Router();

router.get('/', getPopularMovies);
router.get('/search', searchMovies);
router.get('/:id', getMovie);

export default router;
