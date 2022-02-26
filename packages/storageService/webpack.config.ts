import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

const env = process.env.NODE_ENV;

const mode = env === 'development' ? 'development' : 'production';
const watch = env === 'development' ? true : false;
const cache = env === 'development' ? true : false;
const devtool = env === 'development' ? 'inline-source-map' : 'source-map'; //'eval-source-map' (might be faster for dev)

const entry: EntryObject = {
  StorageDialog: [path.resolve(__dirname, 'src', 'StorageDialog.tsx')],
  headless: [path.resolve(__dirname, 'src', 'headless.ts')],
  'StorageDialog.min': [path.resolve(__dirname, 'src', 'StorageDialog.tsx')],
  'headless.min': [path.resolve(__dirname, 'src', 'headless.ts')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  publicPath: '/',
  pathinfo: env === 'development' ? true : false,
  library: 'storage-service',
  libraryTarget: 'umd',
  umdNamedDefine: true,
};

const resolve = {
  alias: { '@src': path.resolve(__dirname, 'src/') },
  extensions: ['.tsx', '.ts', '.js', '.json'],
};

const optimization = {
  emitOnErrors: env === 'development' ? true : false,
  minimize: env === 'development' ? false : true,
  minimizer:
    env === 'development'
      ? []
      : [new ESBuildMinifyPlugin({ target: 'es2020', css: true, include: /\.min\.js$/ })],
  sideEffects: env === 'development' ? false : true,
  usedExports: env === 'development' ? false : true,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new MiniCssExtractPlugin(),
  new webpack.ProvidePlugin({ process: 'process/browser' }),
  new WebpackBar({ color: env === 'development' ? '#7e57c2' : '#9ccc65' }),
];

const stats = env === 'development' ? { children: true } : {};

const webpackConfig: webpack.Configuration = {
  cache,
  devtool,
  entry,
  mode,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'esbuild-loader',
        options: { loader: 'tsx', target: 'es2020' },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        generator: { filename: 'fonts/[name][ext][query]' },
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: { filename: 'images/[name][ext][query]' },
      },
      { test: /\.svg$/, loader: 'svg-inline-loader' },
    ],
  },
  optimization,
  output,
  performance: {
    hints: env === 'development' ? false : 'warning',
  },
  plugins,
  resolve,
  stats,
  watch,
};

export default webpackConfig;
