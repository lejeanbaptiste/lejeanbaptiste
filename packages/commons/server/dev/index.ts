import kleur from 'kleur';
import { Express } from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
// import webpackHotMiddleware from 'webpack-hot-middleware';
import config from '../../webpack.config';

export const devServer = (app: Express) => {
  // // webpack middleware and hot reload
  // if (!config.entry) return;
  // config.entry.index.unshift(
  //   'webpack-hot-middleware/client?path=/__webpack_hmr&reload=true&timeout=1000'
  // ); // Auto-reloading when webpack detects any changes
  // config.plugins.push(new webpack.HotModuleReplacementPlugin()); // Add HMR plugin

  const compiler = webpack(config);
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: '/',
      writeToDisk: true,
      stats: { colors: true },
    })
  );
  // Enable "webpack-hot-middleware"
  // app.use(
  //   webpackHotMiddleware(compiler, {
  //     log: console.log,
  //     path: '/__webpack_hmr',
  //     heartbeat: 10 * 1000,
  //   })
  // );
  kleur.bgBlue().black(`\n Dev Server is online! \n`);
};
