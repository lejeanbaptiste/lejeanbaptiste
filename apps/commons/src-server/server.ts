import compression from 'compression';
import express from 'express';
import fs from 'fs/promises';
import helmet from 'helmet';
import path from 'path';
import { api } from './routes';
import { pluginsApi } from './routes/plugins';

const publicPath = path.join(__dirname, '..', 'public');
const indexHtmlPath = path.join(publicPath, 'index.html');
const isDevelopment = process.env.NODE_ENV === 'development';

export const server = express();

server.use(express.json({ limit: '5mb' })); // support json encoded bodies
server.use(compression());
server.use('/api', api);
server.use('/api/plugins', pluginsApi);
server.use(helmet.frameguard({ action: 'sameorigin' }));
server.use(
  express.static(publicPath, {
    // A watch rebuild can replace app.js and its lazy chunks independently.
    // Never let the browser keep one half of an old development build.
    setHeaders: (res) => {
      if (isDevelopment) res.setHeader('Cache-Control', 'no-store');
    },
  }),
);

// catch all
server.get('*name', async (req, res) => {
  // Do not return the SPA HTML for a missing JavaScript/CSS asset. In
  // development this makes a stale chunk a normal 404, which the renderer
  // recovery handler can safely retry.
  if (req.path.startsWith('/js/') || req.path.startsWith('/css/')) {
    res.sendStatus(404);
    return;
  }

  // Webpack writes public/index.html on first compile (and briefly during
  // rebuilds). Avoid ENOENT stack traces; the desktop dev loader retries
  // until this returns 200.
  try {
    await fs.access(indexHtmlPath);
  } catch {
    res.status(503).send('Application is still building. Retry shortly.');
    return;
  }

  res.status(200).sendFile(indexHtmlPath);
});

export default server;
