import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

const env = process.env.NODE_ENV;

const mode = env === 'development' ? 'development' : 'production';
const watch = env === 'development' ? true : false;
const cache = env === 'development' ? true : false;
const devtool = env === 'development' ? 'inline-source-map' : 'source-map'; // inline-source-map //'eval-source-map' (might be faster for dev)

const entry: EntryObject = {
  'leaf-writer-validator.worker': path.resolve(__dirname, 'src', 'index.worker.ts'),
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  globalObject: 'this',
  library: 'leaf-writer-validator-worker',
  libraryTarget: 'umd',
  umdNamedDefine: true,
};

const plugins = [
  new CleanWebpackPlugin(),
  new WebpackBar()
];

const webpackConfig: webpack.Configuration = {
  cache,
  devtool,
  entry,
  mode,
  output,
  plugins,
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        loader: 'esbuild-loader',
        options: { loader: 'ts', target: 'es2020' },
      },
      {
        test: /\.js?$/,
        loader: 'esbuild-loader',
        options: { loader: 'js', target: 'es2020' },
      },
    ],
  },
  optimization: {
    emitOnErrors: env === 'development' ? true : false,
    minimize: env === 'development' ? false : true,
    minimizer:
      env === 'development'
        ? []
        : [new ESBuildMinifyPlugin({ target: 'es2020', css: true })],
    sideEffects: env === 'development' ? false : true,
    usedExports: env === 'development' ? false : true,
  },
  watch,
};

export default webpackConfig;
