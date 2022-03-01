import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
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
  'leaf-writer': [path.resolve(__dirname, 'src', 'index.tsx')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  publicPath: '/',
  pathinfo: env === 'development' ? true : false,
  libraryTarget: 'umd',
  library: 'leaf-writer',
  umdNamedDefine: true,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new CopyWebpackPlugin({
    patterns: [
      //copy images
      { from: path.resolve(__dirname, 'src', 'images'), to: 'images' },
      {
        //Copy pre-compiled CSS required by tinyMCE
        from: path.resolve(__dirname, 'src', 'css', 'tinymce', 'skins'),
        to: 'css/tinymce/skins',
      },
      {
        //Copy pre-compiled CSS to stylize the editor (must be recompiled after each change)
        context: path.resolve(__dirname, 'src', 'css', 'build'),
        from: 'editor.css',
        to: 'css/editor.css',
        toType: 'file',
      },
      {
        //Copy pre-compiled worker
        context: path.resolve(__dirname, '..', 'validator', 'dist'),
        from: 'leafwriter-validator.worker.js',
        to: 'leafwriter-validator.worker.js',
        toType: 'file',
      },
    ],
  }),

  new MiniCssExtractPlugin(),
  new WebpackBar({ color: env === 'development' ? '#7e57c2' : '#9ccc65' }),
  new webpack.ProvidePlugin({ process: 'process/browser' }),
  new MonacoWebpackPlugin({ languages: ['xml', 'json'] }),
  new webpack.DefinePlugin({
    webpackEnv: {
      LEAFWRITER_VERSION: JSON.stringify(pkg.version),
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
        ? []
        : [new ESBuildMinifyPlugin({ target: 'es2020', css: true, include: /\.min\.js$/ })],
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
