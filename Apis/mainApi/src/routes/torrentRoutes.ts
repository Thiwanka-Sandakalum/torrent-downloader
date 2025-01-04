import express from 'express';
import { downloadMovie, getDownloadedMovies, deleteDownloadedMovies, getDownloadedMovie, deleteDownloadedMovie } from '../controllers';

const router = express.Router();

router.post('/download', downloadMovie);
router.get('/downloads', getDownloadedMovies);
router.delete('/downloads', deleteDownloadedMovies);
router.get('/downloads/:id', getDownloadedMovie);
router.delete('/downloads/:id', deleteDownloadedMovie);

export default router;
