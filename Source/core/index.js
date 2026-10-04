import express from 'express';
import session from 'express-session';
import cors from 'cors';
import apiRouter from '../src/api.js';
import authApp from '../src/auth.js';
import routes from '../src/routes.js';
import {
  assetsDirectory,
  assetsOptions,
  corsOptions,
  sessionOptions,
  setupMiddleware,
  redirectHome,
  notFoundHandler,
  errorHandler,
  startServer
} from './utils.js';

const app = express();

app.set('trust proxy', 1);
setupMiddleware(app);

app.use(cors(corsOptions));
app.use('/assets', express.static(assetsDirectory, assetsOptions));

app.use(express.json());
app.use(session(sessionOptions));

app.get(['/', '/app'], redirectHome);
app.use('/auth', authApp);
app.use('/api', apiRouter);
app.use('/app', routes);

app.use(notFoundHandler);
app.use(errorHandler);

startServer(app);

export default app;
