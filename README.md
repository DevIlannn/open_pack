### Open Pack - Raw source code template
**Open Pack** is a raw source code template for starting web and backend projects fast, built for developers who want to start working right away without deleting examples, dummy data, or unnecessary scaffolding. Built on `Node.js` with `PostgreSQL` as the main data engine, it provides the foundation almost every project needs: a ready-to-run server, a secure database connection, user session management, static page and file serving, clean error handling, and basic security. Everything is kept thin and flexible, not tied to any single type of application, so it works as a starting point for any product, from web apps and dashboards to API services. Open Pack runs locally and deploys to serverless platforms such as `Vercel`, while table schemas, routes, and business logic are fully defined by the developer, not by the template.

### How to use
```bash
## 1. Create a project
npx open_pack@latest my-project
cd my-project
npm install

## 2. Configure the environment
cp .env.examples .env

## 3. Run
npm run dev
```

### Workspace Structure Project
The core folder holds the application's infrastructure. `core/index.js` is the entry point: it assembles the Express app with middleware, sessions, static assets, routers, and error handlers, then exports it as the serverless handler for Vercel, with setup only and no business logic. `core/utils.js` supports it with shared tooling: a colored logger and timer, basic security headers and rate limiting, CORS and session configuration, inline error pages, error helpers, a database listener, and the local server starter.

The `src` folder is the application layer, owned entirely by the developer. It contains the PostgreSQL connection pool and session store, the JSON API router mounted at `/api`, the authentication router and helpers (password hashing, session handling, route guard) mounted at `/auth`, and the page router mounted at `/app` that serves HTML files. Changes inside src do not affect core as long as the exports stay the same.

The `public` folder contains everything the browser receives directly. The assets subfolder serves static resources at `/assets` and is split into image, css, and js. The pages subfolder holds the main HTML pages served through the page router, such as `/app/home` and `/app/auth`, while subpages holds secondary or nested pages that are not mapped to any route by default, leaving the developer free to decide how they are served.
```
Source/
├── core/
│   ├── utils.js
│   └── index.js
├── src/
│   ├── api.js
│   ├── auth.js
│   ├── db.js
│   └── routes.js
├── public/
│   ├── assets/
│   ├── pages/
│   └── subpages/
├── .env.examples
├── .gitignore
├── package.json
└── vercel.json
```

### Source code - Fast Starter pack
A super simple version of the server for when you want a running backend in minutes. The whole backend lives in just two files inside `src/`: `server.js` sets up Express with CORS, cookie-based sessions, static file serving, a health check route, and a database check on startup, while `db.js` provides the PostgreSQL connection. The `public/` folder holds a single `index.html` entry page and an `assets/` folder for images, styles, and scripts, all served directly by the server. It listens on a port during local development and exports the app for serverless platforms in production, so the included `vercel.json` is enough to deploy it. Use it for quick prototypes and experiments, then move to the full `core/` and `src/` structure above when the project needs a session store, security middleware, structured routing, and error pages.

```
Fast_source_code/
├── src/
│   ├── server.js
│   └── db.js
├── public/
│   ├── assets/
│   └── index.html
├── .env
├── .gitignore
├── package.json
└── vercel.json
```

***SOURCE CODE :***
_server.js_
The Express server. It sets up CORS, sessions, and static file serving from `public/`, defines the `/app` page route and `/health` check, and starts listening locally or exports the app for Vercel in production.
```js
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'node:path';
import { checkDatabase } from './db.js';

dotenv.config();

const app = express();
const publicDirectory = path.join(import.meta.dirname, '..', 'public');

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
  })
);

app.use(express.static(publicDirectory));

app.get('/app', (request, response) => {
  response.sendFile('index.html', { root: publicDirectory });
});

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'production') {
  await checkDatabase();
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}

export default app;
```

_db.js_
The PostgreSQL connection. It creates the connection pool from `DATABASE_URL` and provides `checkDatabase()` to verify the connection on startup.
```db.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

export async function checkDatabase() {
  await pool.query('SELECT 1');
}

export default pool;
```

***CONFIGURATION FILES***
```env 
PORT=3000
CORS_ORIGIN=true
SESSION_SECRET=KEY_SECRET_IN_HERE
NODE_ENV=development
DATABASE_URL=postgresql://neondb_owner:npg_XXXXXXX
```
```.gitignore
node_modules/
.env

logs/
*.log

.DS_Store
Thumbs.db

.vercel/
.git/

.vscode/
.idea/
```
```vercel.json
{
    "version": 2,
    "builds": [
        {
            "src": "src/server.js",
            "use": "@vercel/node"
        }
    ],
    "routes": [
        {
            "src": "/(.*)",
            "dest": "src/server.js"
        }
    ]
}
```
```package.json
{
  "name": "application",
  "version": "1.0.0",
  "description": "Express backend server with PostgreSQL and session-based authentication",
  "type": "module",
  "main": "src/server.js",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "audit:cek": "npm audit --omit=dev"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "compression": "^1.7.5",
    "connect-pg-simple": "^10.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "express-rate-limit": "^7.4.1",
    "express-session": "^1.18.1",
    "helmet": "^8.0.0",
    "morgan": "^1.10.0",
    "nanoid": "^5.0.9",
    "pg": "^8.13.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": [
    "express",
    "postgresql",
    "session-auth",
    "backend"
  ]
}
```