import { Router } from 'express';
import pool from './db.js';

const router = Router();

router.get('/status', async (request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.json({
      success: true,
      message: 'Backend server is running and ready to handle API requests'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
