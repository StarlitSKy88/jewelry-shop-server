import { Router } from 'express';
import { getAbout } from '../controllers/about.controller';

const router = Router();

router.get('/', getAbout);

export default router; 