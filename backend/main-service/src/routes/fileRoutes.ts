import express from 'express';
import { uploadFile, deleteFile } from '../controllers';

const router = express.Router();

router.post('/upload', uploadFile);
router.delete('/delete/:id', deleteFile);

export default router;
