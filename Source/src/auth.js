import express, { Router } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { sessionStore } from './db.js';

export const authPrefix = '/auth';
export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 1000 * 60 * 15,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

authRouter.use(authLimiter);

export const authMiddleware = [
  express.json(),
  express.urlencoded({ extended: true }),
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
];