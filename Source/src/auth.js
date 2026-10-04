import express from 'express';
import bcrypt from 'bcryptjs';
import pool from './db.js';

const router = express.Router();

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function startSession(request, userId) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return reject(regenerateError);
      }
      request.session.userId = userId;
      request.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

export function endSession(request) {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

export function requireAuth(request, response, next) {
  if (!request.session.userId) {
    return response.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
}

export default router;
