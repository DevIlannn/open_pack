import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { checkConnection, useMigration } from './db.js';
import { apiPrefix, apiRouter } from './api.js';
import { authPrefix, authRouter, authMiddleware } from './auth.js';

const app = express();
const port = process.env.PORT || 3000;
const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public'
);
const errorsPage = path.join(publicDirectory, 'errors.html');
const pagesDirectory = path.join(publicDirectory, 'pages');

const errorCatalog = {
  400: ['Bad Request', 'The request could not be understood.'],
  401: ['Unauthorized', 'You need to sign in to continue.'],
  403: ['Forbidden', 'You do not have permission to access this page.'],
  404: ['Not Found', 'The page you are looking for does not exist.'],
  405: ['Method Not Allowed', 'This action is not allowed here.'],
  408: ['Request Timeout', 'The request took too long. Please try again.'],
  409: ['Conflict', 'The request conflicts with existing data.'],
  410: ['Gone', 'This page has been permanently removed.'],
  413: ['Payload Too Large', 'The data you sent is too large.'],
  415: ['Unsupported Media Type', 'This type of content is not supported.'],
  422: ['Unprocessable Entity', 'The data you sent failed validation.'],
  429: ['Too Many Requests', 'Too many requests. Please slow down and try again later.'],
  500: ['Internal Server Error', 'Something went wrong on our side.'],
  501: ['Not Implemented', 'This feature is not available yet.'],
  502: ['Bad Gateway', 'The server received an invalid response.'],
  503: ['Service Unavailable', 'The service is temporarily unavailable. Please try again soon.'],
  504: ['Gateway Timeout', 'The server took too long to respond.']
};

const parseErrorCode = (value) => {
  const code = Number(value);
  return Number.isInteger(code) && code >= 400 && code <= 599 ? code : null;
};

const describeError = (code) => {
  const side = code < 500 ? 'client' : 'server';
  const fallback = side === 'client'
    ? ['Client Error', 'The request could not be completed.']
    : ['Server Error', 'Something went wrong on our side.'];
  const [title, message] = errorCatalog[code] || fallback;
  return { code, side, title, message };
};

const wantsPage = (req) => req.headers.accept?.includes('text/html');

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true
}));
app.use(authMiddleware);
app.use(express.static(publicDirectory));
app.use(apiPrefix, apiRouter);
app.use(authPrefix, authRouter);

app.get('/app', (req, res) => {
  res.redirect('/');
});

app.get('/app/:page', (req, res, next) => {
  res.sendFile(`${req.params.page}.html`, { root: publicDirectory }, (error) => {
    if (error && !res.headersSent) next(error.status === 404 ? undefined : error);
  });
});

app.get('/errors/:code/info', (req, res, next) => {
  const code = parseErrorCode(req.params.code);
  if (!code) return next();
  res.json(describeError(code));
});

app.get('/errors/:code', (req, res, next) => {
  const code = parseErrorCode(req.params.code);
  if (!code) return next();
  res.status(code).sendFile(errorsPage);
});

app.use((req, res) => {
  if (wantsPage(req)) return res.redirect('/errors/404');
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error(logSymbols.error, chalk.red(error.message));
  if (wantsPage(req)) return res.redirect('/errors/500');
  res.status(500).json({ error: 'Internal server error' });
});

if (await checkConnection()) {
  await useMigration();
}

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(logSymbols.success, chalk.green('Server running on'), chalk.bold(`http://localhost:${port}`));
  });
}

export default app;