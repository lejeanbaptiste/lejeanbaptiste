import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { api } from './routes';
import compression from 'compression';

const publicPath = path.join(__dirname, '..', 'dist');

const server = express();


server.use(express.json({ limit: '5mb' })); // support json encoded bodies
server.use(compression())

server.use('/api', api);

// dev server
const loadDevServer = async () => {
  const { devServer } = await import('./dev');
  devServer(server);
};

if (process.env.WEBPACK_DEV === 'true') loadDevServer();

server.use(helmet.frameguard({ action: 'SAMEORIGIN' }));

server.use(express.static(publicPath));

// catch all
// * turn off on dev. reason HMR doesn't work with this on.
// if (process.env.NODE_ENV !== 'development') {
server.get('*', (req, res) => {
  // log.info('catch all');
  // res.set('Content-Type', 'text/event-stream');
  res.status(200).sendFile(path.join(publicPath, 'index.html'));
});

// app.use('*', express.static(path.join(publicPath, 'index.html')));

export default server;
