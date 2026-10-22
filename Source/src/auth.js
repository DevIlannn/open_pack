import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import express, { Router } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { sessionStore } from './db.js';

const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
const scryptAsync = promisify(scrypt);

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

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.userId = userId;
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
