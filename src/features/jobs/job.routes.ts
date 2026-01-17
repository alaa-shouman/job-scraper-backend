import { Router } from 'express';
import { getJobs } from './job.controller';

const router = Router();

router.get('/jobs', getJobs);

export default router;

