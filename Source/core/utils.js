import path from 'node:path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import pool, { sessionStore } from '../src/db.js';

dotenv.config();

const { NODE_ENV, PORT, CORS_ORIGIN, SESSION_SECRET } = process.env;
const root = path.join(import.meta.dirname, '..', 'public');

const errorMessages = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Access forbidden',
  404: 'Page not found',
  409: 'Conflict',
  429: 'Too many requests',
  500: 'Internal server error'
};

const errorDescriptions = {
  400: 'The request could not be understood by the server.',
  401: 'You need to sign in to access this page.',
  403: "You don't have permission to access this page.",
  404: "The page you are looking for doesn't exist or an error occurred.",
  409: 'The request conflicts with the current state of the resource.',
  429: 'Too many requests were sent. Please try again in a moment.',
  500: 'Something went wrong on our side. Please try again later.'
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderErrorPage(code, title, description) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${code} ${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&family=Poppins:wght@400;700&display=swap" rel="stylesheet">
<style>
:root {
  --color-background: #fefefe;
  --color-text: #2b2d31;
  --color-link: #1a73e8;
  --font-primary: 'Poppins', 'JetBrains Mono', sans-serif;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 24px 96px;
  text-align: center;
  background: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-primary);
}
h1 {
  font-size: clamp(96px, 22vw, 160px);
  font-weight: 700;
  line-height: 1;
}
h2 {
  font-size: 24px;
  font-weight: 400;
}
p {
  max-width: 420px;
  font-size: 12px;
  line-height: 1.6;
}
a {
  color: var(--color-link);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
</style>
</head>
<body>
<h1>${code}</h1>
<h2>${safeTitle}</h2>
<p>${safeDescription}<br><a href="/app/home" onclick="history.back(); return false;">Go back</a>, or head over to <a href="/app/home">home</a> to choose a new direction.</p>
</body>
</html>`;
}

const databaseStatuses = {
  '23505': 409,
  '23503': 409,
  '23502': 400,
  '22001': 400,
  '22P02': 400
};

const levelColors = {
  info: chalk.cyan,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red
};

function write(level, message) {
  const label = levelColors[level](level.toUpperCase().padEnd(7));
  const output = `${chalk.gray(new Date().toISOString())} ${label} ${message}`;
  const target = level === 'error' ? console.error : console.log;
  target(output);
}

export const logger = {
  info: (message) => write('info', message),
  success: (message) => write('success', message),
  warn: (message) => write('warn', message),
  error: (message) => write('error', message)
};

export function createTimer() {
  const start = process.hrtime.bigint();
  return {
    stop: () => Math.round((Number(process.hrtime.bigint() - start) / 1e6) * 10) / 10
  };
}

const bootTimer = createTimer();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function createError(status, message) {
  return new HttpError(status, message ?? errorMessages[status]);
}

export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function resolveStatus(error) {
  return error.status ?? error.statusCode ?? databaseStatuses[error.code] ?? 500;
}

function colorStatus(status) {
  if (status >= 500) return chalk.red(status);
  if (status >= 400) return chalk.yellow(status);
  if (status >= 300) return chalk.cyan(status);
  return chalk.green(status);
}

export const assetsDirectory = path.join(root, 'assets');

export const assetsOptions = {
  index: false,
  maxAge: '7d'
};

export const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true
};

export const sessionOptions = {
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
};

export function requestLogger(request, response, next) {
  const timer = createTimer();

  response.on('finish', () => {
    logger.info(
      `${request.method} ${request.originalUrl} ${colorStatus(response.statusCode)} ${timer.stop()}ms`
    );
  });

  next();
}

export function securityHeaders(request, response, next) {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });

  if (NODE_ENV !== 'production') {
    return next();
  }

  response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

export function rateLimiter({ windowMs = 60000, max = 100 } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, windowMs).unref();

  return (request, response, next) => {
    const now = Date.now();
    const entry = hits.get(request.ip);

    if (!entry || entry.resetAt <= now) {
      hits.set(request.ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      response.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(createError(429));
    }

    next();
  };
}

export function setupMiddleware(app) {
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(rateLimiter());
}

function sendError(request, response, status, message) {
  const isKnown = errorMessages[status];
  const isClientError = status >= 400 && status < 500;
  const code = isKnown ? status : isClientError ? 400 : 500;

  response.status(code);

  if (request.accepts(['json', 'html']) !== 'html') {
    return response.json({ success: false, message: message ?? errorMessages[code] });
  }

  response.send(renderErrorPage(code, errorMessages[code], message ?? errorDescriptions[code]));
}

export function redirectHome(request, response) {
  response.redirect('/app/home');
}

export function notFoundHandler(request, response) {
  sendError(request, response, 404);
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const status = resolveStatus(error);
  const summary = `${request.method} ${request.originalUrl} ${colorStatus(status)} ${error.message}`;

  if (status >= 500) {
    logger.error(`${summary}\n${chalk.gray(error.stack)}`);
  } else {
    logger.warn(summary);
  }

  sendError(request, response, status, error instanceof HttpError ? error.message : undefined);
}

function watchDatabase() {
  pool.on('connect', () => logger.info('Database client connected'));
  pool.on('remove', () => logger.warn('Database client removed from pool'));
}

async function checkDatabase() {
  const timer = createTimer();

  try {
    await pool.query('SELECT 1');
    logger.success(`Database connected in ${timer.stop()}ms`);
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
  }
}

export async function startServer(app) {
  watchDatabase();

  if (NODE_ENV !== 'production') {
    await checkDatabase();
    app.listen(PORT, () => {
      logger.success(`Server running on port ${PORT} (ready in ${bootTimer.stop()}ms)`);
    });
  }
}
