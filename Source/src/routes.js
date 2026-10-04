import { Router } from 'express';
import path from 'node:path';

const router = Router();
const root = path.join(import.meta.dirname, '..', 'public');

router.get('/home', (request, response) => {
  response.sendFile('pages/home.html', { root });
});

router.get('/auth', (request, response) => {
  response.sendFile('pages/auth.html', { root });
});

export default router;
