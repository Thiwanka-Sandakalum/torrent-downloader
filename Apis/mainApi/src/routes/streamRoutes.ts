import express from 'express';
import { streamMovie } from '../controllers';

const router = express.Router();

router.get('/stream/:id', streamMovie);

export default router;
