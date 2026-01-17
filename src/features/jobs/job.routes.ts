import { Router } from 'express';
import { getJobs } from './job.controller';

const router = Router();

router.post('/jobs', getJobs);

export default router;

