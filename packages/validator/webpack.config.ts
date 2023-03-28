import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { EsbuildPlugin } from 'esbuild-loader';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

const isDev = process.env.NODE_isDev;

const entry: EntryObject = {
  'leafwriter-validator.worker': path.resolve(__dirname, 'src', 'index.worker.ts'),
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  globalObject: 'this',
  library: 'leafwriter-validator',
  libraryTarget: 'umd',
  umdNamedDefine: true,
};

const plugins = [new CleanWebpackPlugin(), new WebpackBar()];

const webpackConfig: webpack.Configuration = {
  entry,
  output,
  plugins,
  cache: isDev ? true : false,
  devtool: isDev ? 'inline-source-map' : 'source-map', // inline-source-map //'eval-source-map' (might be faster for dev),
  resolve: { extensions: ['.ts', '.js'] },
  mode: isDev ? 'development' : 'production',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: 'esbuild-loader',
        options: { tsconfig: './tsconfig.json', target: 'es2020' },
      },
    ],
  },
  optimization: {
    emitOnErrors: isDev ? true : false,
    minimize: isDev ? false : true,
    minimizer: isDev ? [] : [new EsbuildPlugin()],
    sideEffects: isDev ? false : true,
    usedExports: isDev ? false : true,
  },
  watch: isDev ? true : false,
};

export default webpackConfig;
