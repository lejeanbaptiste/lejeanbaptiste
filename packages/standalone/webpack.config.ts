import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack, { EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

const isDev = process.env.NODE_ENV === 'development';

const entry: EntryObject = {
  app: [path.resolve(__dirname, 'src', 'index.tsx')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  publicPath: '/',
  pathinfo: isDev ? true : false,
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
        from: isDev
          ? path.resolve(__dirname, '..', 'core', 'src', 'images')
          : // : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'images'),
            path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'images'),
        to: 'images',
      },
      {
        context: isDev
          ? path.resolve(__dirname, '..', 'core', 'src', 'css', 'tinymce')
          : // : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'css', 'tinymce'),
            path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'css', 'tinymce'),
        from: 'skins',
        to: 'css/tinymce/skins',
      },
      {
        //Copy pre-compiled CSS to stylize the editor (must be recompiled after each change)
        context: isDev
          ? path.resolve(__dirname, '..', 'core', 'src', 'css', 'build')
          : // : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'src', 'css', 'build'),
            path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'css'),
        from: 'editor.css',
        to: 'css/editor.css',
        toType: 'file',
      },
      {
        //Copy pre-compiled worker
        context: isDev
          ? path.resolve(__dirname, '..', 'validator', 'dist')
          : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter-validator', 'dist'),
        from: 'leafwriter-validator.worker.js',
        to: 'leafwriter-validator.worker.js',
        toType: 'file',
      },
    ],
  }),
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, 'src', 'index.html'),
    favicon: path.resolve(__dirname, 'src', 'assets', 'logo', 'favicon-32x32.png'),
  }),
  new MonacoWebpackPlugin({ languages: ['xml', 'json'] }),
  new MiniCssExtractPlugin(),
  new WebpackBar({ color: isDev ? '#7e57c2' : '#9ccc65' }),
  new webpack.DefinePlugin({
    webpackEnv: {
      AUTHORIZATION_CALLBACK_URL: JSON.stringify(process.env.AUTHORIZATION_CALLBACK_URL),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      WORKER_ENV: JSON.stringify(process.env.WORKER_ENV),
    },
  }),
  new webpack.ProvidePlugin({ process: 'process/browser' }),
];

const webpackConfig: webpack.Configuration = {
  entry,
  output,
  plugins,
  cache: isDev ? true : false,
  devtool: isDev ? 'inline-source-map' : 'source-map', // inline-source-map //'eval-source-map' (might be faster for dev),
  mode: isDev ? 'development' : 'production',
  performance: { hints: isDev ? false : 'warning' },
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
                globalVars: { parentId: '#leafwriterContainer' },
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
        options: { removeSVGTagAttrs: false },
      },
    ],
  },
  optimization: {
    emitOnErrors: isDev ? true : false,
    minimize: isDev ? false : true,
    minimizer: isDev ? [] : [new ESBuildMinifyPlugin({ target: 'es2020', css: true })],
    sideEffects: isDev ? false : true,
    usedExports: isDev ? false : true,
  },
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
  stats: isDev ? { children: true } : {},
  watch: isDev ? true : false,
};

webpackConfig.resolve?.fallback;

export default webpackConfig;
