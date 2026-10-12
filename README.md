## Source code - Fast Starter pack
Open Pack exists so that starting a new project feels like starting, not cleaning up. Our vision is a world where every developer can begin building the moment an idea arrives, without deleting examples or fighting scaffolding. Our mission is to provide a thin, honest foundation that holds only what every project needs and leaves every decision to its owner. The goal is simple: less setup, more building.

### How to use - Start Building in Minutes
Requires `Node.js 20.6` or newer and a PostgreSQL database.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=black)
```bash
## 1. Create a project
npx @ilanalimanjs/open_pack@latest my-project
cd my-project
npm install

## 2. Configure the environment
cp .env.examples .env

## 3. Run
npm run dev
```
**In step 2**, open `.env` and fill in `DATABASE_URL` with your PostgreSQL connection string and `SESSION_SECRET` with a long random string. `PORT` is optional and defaults to 3000.

**In step 3**, the server restarts automatically whenever you edit a file in `src/`. Open `http://localhost:3000/api/health` to confirm the server and database are connected.

## Workspace Structure Project
The `src` folder holds the entire application logic. `server.js` is the entry point: it assembles the Express app with middleware, sessions, static files, routers, and error handlers, then starts the local server and exports the app as the serverless handler for Vercel. `db.js` contains the PostgreSQL connection pool and session store, `api.js` is the JSON router mounted at `/api`, and `auth.js` is the authentication router with its helpers (password hashing, session handling, route guard) mounted at `/auth`. Table schemas, routes, and business logic are fully defined by the developer.

The `public` folder contains everything the browser receives directly. The `assets` subfolder serves static resources such as images, styles, and scripts, while `index.html` is the main page served at the root. At the project root, `.env.examples` lists the environment variables to copy into `.env`, `package.json` defines dependencies and scripts, and `vercel.json` configures the serverless deployment.
```
Source/
├── src/
│   ├── api.js
│   ├── auth.js
│   ├── db.js
│   └── server.js
├── public/
│   ├── assets/
│   └── index.html
├── .env.examples
├── .gitignore
├── package.json
└── vercel.json
```

## What’s Inside
### 1. Instant page routes, no code needed
Add an HTML file to `public/pages/` and it is instantly available in the browser at `/app/` followed by the file name. No route to register, no server code to touch.
```
public/pages/dashboard.html   ->  /app/dashboard
public/pages/profile.html     ->  /app/profile
public/pages/auth.html        ->  /app/auth
```
To try it, create `public/pages/hello.html`, run the project, and open `/app/hello`. If the file does not exist, visitors are sent to a clean 404 page automatically. Keep your styles, scripts, and images in `public/assets/` and link them with absolute paths such as `/assets/css/style.css`.

### 2. Browser client and server side handling
Every error is handled by one page, `public/errors.html`, working together with `server.js`. When a request fails, the server checks whether it came from a browser or an API client. Browsers are redirected to the error page, while API clients keep receiving plain JSON, so fetch calls never break. The `/errors/:code` route accepts any code from 400 to 599 and serves the page with that real HTTP status.

**Server side** (`src/server.js`)
The server owns the error catalog and classifies each code: 4xx is a client-side error, 5xx is a server-side error. Codes missing from the catalog fall back to a generic title and message, so no visitor ever sees a blank page.
```js
const wantsPage = (req) => req.headers.accept?.includes('text/html');

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
```

**Client side** (`public/errors.html`)
The page reads the code from the address, fetches its details from the server, and fills in the side, title, and message.
```js
const code = location.pathname.split('/').filter(Boolean).pop();

fetch(`/errors/${code}/info`)
  .then((response) => response.json())
  .then((error) => {
    document.title = `${error.code} ${error.title}`;
    document.getElementById('side').textContent = sideLabels[error.side];
    document.getElementById('title').textContent = error.title;
    document.getElementById('message').textContent = error.message;
  });
```