import path from 'path';
import express from 'express';
import helmet from 'helmet';

const publicPath = path.join(__dirname, '..', 'dist');

const app = express();

app.use(express.json({ limit: '5mb' })); // support json encoded bodies

// dev tools
const loadDevTools = async () => {
  const { devTools } = await import('./dev/dev');
  devTools(app);
};

if (process.env.WEBPACK_DEV === 'true') loadDevTools();

app.use(helmet.frameguard({ action: 'SAMEORIGIN' }));

app.use(express.static(publicPath));

// catch all
// * turno off on dev. reason HMR doesn't work with this on.
// if (process.env.NODE_ENV !== 'development') {
app.get('*', (req, res) => {
  // console.log('catch all');
  // res.set('Content-Type', 'text/event-stream');
  res.status(200).sendFile(path.join(publicPath, 'index.html'));
});

// app.use('*', express.static(path.join(publicPath, 'index.html')));

export default app;
