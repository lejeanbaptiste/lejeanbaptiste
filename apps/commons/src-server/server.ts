import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { api } from './routes';

const publicPath = path.join(__dirname, '..', 'public');

export const server = express();

server.use(express.json({ limit: '5mb' })); // support json encoded bodies
server.use(compression());
server.use('/api', api);
server.use(helmet.frameguard({ action: 'sameorigin' }));
server.use(express.static(publicPath));

// catch all
server.get('*name', (_req, res) => {
  res.status(200).sendFile(path.join(publicPath, 'index.html'));
});

export default server;
