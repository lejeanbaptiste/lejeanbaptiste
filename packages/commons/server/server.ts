import path from 'path';
import express from 'express';
import helmet from 'helmet';

const publicPath = path.join(__dirname, '..', 'dist');
import schemaRouter from './routes/schema';

const server = express();

server.use(express.json({ limit: '5mb' })); // support json encoded bodies
server.use('/schema', schemaRouter);

// dev server
const loadDevServer  = async () => {
  const { devServer } = await import('./dev');
  devServer(server);
};

if (process.env.WEBPACK_DEV === 'true') loadDevServer ();

server.use(helmet.frameguard({ action: 'SAMEORIGIN' }));

server.use(express.static(publicPath));

// catch all
// * turn off on dev. reason HMR doesn't work with this on.
// if (process.env.NODE_ENV !== 'development') {
  server.get('*', (req, res) => {
  // console.log('catch all');
  // res.set('Content-Type', 'text/event-stream');
  res.status(200).sendFile(path.join(publicPath, 'index.html'));
});

// app.use('*', express.static(path.join(publicPath, 'index.html')));

export default server;
