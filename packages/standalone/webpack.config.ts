import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

const env = process.env.NODE_ENV;
const envWorker = process.env.WORKER_ENV;

const mode = env === 'development' ? 'development' : 'production';
const watch = env === 'development' ? true : false;
const cache = env === 'development' ? true : false;
const devtool = env === 'development' ? 'inline-source-map' : 'source-map'; // inline-source-map //'eval-source-map' (might be faster for dev)

const entry: EntryObject = {
  app: [path.resolve(__dirname, 'src', 'index.tsx')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  publicPath: '/',
  pathinfo: env === 'development' ? true : false,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new CopyWebpackPlugin({
    patterns: [
      { from: path.resolve(__dirname, 'src', 'assets'), to: 'assets' },
      { from: path.resolve(__dirname, 'src', 'config'), to: 'config' },
      { from: path.resolve(__dirname, 'src', 'content'), to: 'content' },
      {
        context: path.resolve(__dirname, 'src'),
        from: 'silent-check-sso.html',
        to: 'silent-check-sso.html',
        toType: 'file',
      },
      {
        context: path.resolve(__dirname, 'src'),
        from: 'manifest.json',
        to: 'manifest.json',
        toType: 'file',
      },
      //
      {
        //copy images from Writer-Base
        from:
          env === 'development'
            ? path.resolve(__dirname, '..', 'core', 'src', 'images')
            : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'images'),
        to: 'images',
      },
      {
        context:
          env === 'development'
            ? path.resolve(__dirname, '..', 'core', 'src', 'css', 'tinymce')
            : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'css', 'tinymce'),
        from: 'skins',
        to: 'css/tinymce/skins',
      },
      {
        //Copy pre-compiled CSS to stylize the editor (must be recompiled after each change)
        context:
          env === 'development'
            ? path.resolve(__dirname, '..', 'core', 'src', 'css', 'build')
            : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'css', 'build'),
        from: 'editor.css',
        to: 'css/editor.css',
        toType: 'file',
      },
      {
        //Copy pre-compiled worker
        context:
          env === 'development'
            ? path.resolve(__dirname, '..', 'worker-validator', 'dist')
            : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter-validator-worker', 'dist'),
        from: 'leaf-writer-validator.worker.js',
        to: 'leaf-writer-validator.worker.js',
        toType: 'file',
      },
    ],
  }),
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, 'src', 'index.html'),
    favicon: path.resolve(__dirname, 'src', 'assets', 'logo', 'favicon-32x32.png'),
  }),
  new MiniCssExtractPlugin(),
  new WebpackBar({ color: env === 'development' ? '#7e57c2' : '#9ccc65' }),
  new webpack.ProvidePlugin({
    process: 'process/browser',
  }),
  new MonacoWebpackPlugin({
    languages: ['xml', 'json'],
  }),
  new webpack.DefinePlugin({
    webpackEnv: {
      AUTHORIZATION_CALLBACK_URL: JSON.stringify(process.env.AUTHORIZATION_CALLBACK_URL),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      WORKER_ENV: JSON.stringify(process.env.WORKER_ENV),
    },
  }),
];

const performanceHints = env === 'development' ? false : 'warning';

const debug = env === 'development' && false;
const stats = debug ? { children: true } : {};

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
        test: /\.jsx?$/,
        loader: 'esbuild-loader',
        options: { loader: 'jsx', target: 'es2020' },
      },
      {
        test: /\.(le|c)ss$/,
        use: [
          { loader: MiniCssExtractPlugin.loader, options: { publicPath: '../' } },
          { loader: 'css-loader' },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                relativeUrls: 'local',
                globalVars: { parentId: '#cwrcWriterContainer' },
              },
            },
          },
        ],
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
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader',
        options: {
          removeSVGTagAttrs: false,
        },
      },
    ],
  },
  optimization: {
    emitOnErrors: env === 'development' ? true : false,
    minimize: env === 'development' ? false : true,
    minimizer:
      env === 'development'
        ? undefined
        : [new ESBuildMinifyPlugin({ target: 'es2020', css: true })],
    sideEffects: env === 'development' ? false : true,
    usedExports: env === 'development' ? false : true,
  },
  output,
  performance: {
    hints: performanceHints,
  },
  plugins,
  resolve: {
    alias: { '@src': path.resolve(__dirname, 'src/') },
    extensions: ['.tsx', '.ts', '.js', '.json'],
    fallback: {
      buffer: false,
      events: false,
      fs: false,
      path: false,
      process: false,
      querystring: false,
      url: false,
    },
  },
  stats,
  watch,
};

webpackConfig.resolve?.fallback;

export default webpackConfig;
