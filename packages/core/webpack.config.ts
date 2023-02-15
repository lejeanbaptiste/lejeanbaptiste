import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { EsbuildPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

import pkg from './package.json';

const isDev = process.env.NODE_isDev;

const entry: EntryObject = {
  index: [path.resolve(__dirname, 'src', 'index.tsx')],
  'index.min': [path.resolve(__dirname, 'src', 'index.tsx')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  // publicPath: '/',
  pathinfo: isDev ? true : false,
  library: {
    name: 'Leafwriter',
    type: 'umd',
    umdNamedDefine: true,
  },
};

const optimization = {
  emitOnErrors: isDev ? true : false,
  minimize: isDev ? false : true,
  minimizer: isDev
    ? []
    : [new EsbuildPlugin({ target: 'es2020', css: true, include: /\.min\.js$/ })],
  sideEffects: isDev ? false : true,
  usedExports: isDev ? false : true,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new CopyWebpackPlugin({
    patterns: [
      //images
      { from: path.resolve(__dirname, 'src', 'images'), to: 'images' },
      //pre-compiled CSS required by tinyMCE
      { from: path.resolve(__dirname, 'src', 'css', 'tinymce', 'skins'), to: 'css/tinymce/skins' },
      //pre-compiled CSS to stylize the editor
      { from: path.resolve(__dirname, 'src', 'css', 'build', 'editor.css'), to: 'css/[name][ext]' },
      //pre-compiled worker
      { from: path.resolve(__dirname, '..', 'validator', 'dist') },
    ],
  }),

  new MiniCssExtractPlugin({ filename: 'css/[name].css' }),
  new MonacoWebpackPlugin({ filename: 'monaco-[name].[ext].js', languages: ['xml', 'json'] }),
  new WebpackBar({ color: isDev ? '#7e57c2' : '#9ccc65' }),
  new webpack.DefinePlugin({
    webpackEnv: {
      LEAFWRITER_VERSION: JSON.stringify(pkg.version),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      WORKER_ENV: JSON.stringify(process.env.WORKER_ENV),
    },
  }),
  new webpack.ProvidePlugin({ process: 'process/browser' }),
];

const webpackConfig: webpack.Configuration = {
  entry,
  optimization,
  output,
  plugins,
  cache: isDev ? true : false,
  devtool: isDev ? 'inline-source-map' : 'source-map', // inline-source-map //'eval-source-map' (might be faster for dev),
  mode: isDev ? 'development' : 'production',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: 'esbuild-loader',
        options: { tsconfig: './tsconfig.json', target: 'es2020' },
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
                globalVars: { parentId: '#leaf-writer-container' },
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
        generator: { filename: 'images/[name][ext][query]' },
        options: { removeSVGTagAttrs: false },
      },
    ],
  },
  performance: { hints: isDev ? false : 'warning' },
  resolve: {
    // alias: { '@src': path.resolve(__dirname, 'src/') },
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
  stats: isDev ? { children: true } : {},
  watch: isDev ? true : false,
};

export default webpackConfig;
