import { Router } from 'express';
import { pool } from './db.js';

export const apiPrefix = '/api';
export const apiRouter = Router();

apiRouter.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});