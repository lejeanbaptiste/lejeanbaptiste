import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

const isDev = process.env.NODE_isDev;

const entry: EntryObject = {
  index: [path.resolve(__dirname, 'src', 'index.tsx')],
  StorageDialog: [path.resolve(__dirname, 'src', 'StorageDialog.tsx')],
  headless: [path.resolve(__dirname, 'src', 'headless.ts')],
  'index.min': [path.resolve(__dirname, 'src', 'index.tsx')],
  'StorageDialog.min': [path.resolve(__dirname, 'src', 'StorageDialog.tsx')],
  'headless.min': [path.resolve(__dirname, 'src', 'headless.ts')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  publicPath: '/',
  pathinfo: isDev ? true : false,
  library: 'storage-service',
  libraryTarget: 'umd',
  umdNamedDefine: true,
};

const optimization = {
  emitOnErrors: isDev ? true : false,
  minimize: isDev ? false : true,
  minimizer: isDev
    ? []
    : [new ESBuildMinifyPlugin({ target: 'es2020', css: true, include: /\.min\.js$/ })],
  sideEffects: isDev ? false : true,
  usedExports: isDev ? false : true,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new MiniCssExtractPlugin(),
  new webpack.ProvidePlugin({ process: 'process/browser' }),
  new WebpackBar({ color: isDev ? '#7e57c2' : '#9ccc65' }),
];

const resolve = {
  alias: { '@src': path.resolve(__dirname, 'src/') },
  extensions: ['.tsx', '.ts', '.js', '.json'],
};

const webpackConfig: webpack.Configuration = {
  entry,
  output,
  plugins,
  resolve,
  cache: isDev ? true : false,
  devtool: isDev ? 'inline-source-map' : 'source-map', //'eval-source-map' (might be faster for dev),
  mode: isDev ? 'development' : 'production',
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
  performance: { hints: isDev ? false : 'warning' },
  stats: isDev ? { children: true } : {},
  watch: isDev ? true : false,
};

export default webpackConfig;
