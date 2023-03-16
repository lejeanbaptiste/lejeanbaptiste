import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { EsbuildPlugin } from 'esbuild-loader';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import webpack, { type EntryObject } from 'webpack';
import WebpackBar from 'webpackbar';

const isDev = process.env.NODE_ENV === 'development';

const entry: EntryObject = {
  app: [path.resolve(__dirname, 'src', 'index.tsx')],
};

const output = {
  path: path.resolve(__dirname, 'dist'),
  filename: 'js/[name].js',
  pathinfo: isDev ? true : false,
};

const plugins = [
  new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
  new CopyWebpackPlugin({
    patterns: [
      { from: path.resolve(__dirname, 'src', 'assets'), to: 'assets' },
      { from: path.resolve(__dirname, 'src', 'content'), to: 'content' },
      { from: 'src/silent-check-sso.html', to: '[name][ext]' },
      { from: 'src/manifest.json', to: '[name][ext]' },
      //
      {
        //copy images from LEAF-Writer core
        from: isDev
          ? path.resolve(__dirname, '..', 'core', 'src', 'images')
          : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'lib', 'images'),
        to: 'images',
      },
      {
        context: isDev
          ? path.resolve(__dirname, '..', 'core', 'src')
          : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'lib'),
        from: 'css/tinymce/skins',
        to: 'css/tinymce/skins',
      },
      {
        //Copy pre-compiled CSS to stylize the editor (must be recompiled after each change)
        from: isDev
          ? path.resolve(__dirname, '..', 'core', 'src', 'css', 'build', 'editor.css')
          : path.resolve(__dirname, 'node_modules', '@cwrc/leafwriter', 'lib', 'css', 'editor.css'),
        to: 'css/[name][ext]',
      },
      {
        //Copy pre-compiled worker
        from: isDev
          ? path.resolve(__dirname, '..', 'validator', 'dist')
          : path.resolve(
              __dirname,
              'node_modules',
              '@cwrc/leafwriter-validator',
              'dist',
              'leafwriter-validator.worker.js'
            ),
      },
    ],
  }),
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, 'src', 'index.html'),
    favicon: path.resolve(__dirname, 'src', 'assets', 'logo', 'favicon.svg'),
  }),
  new MiniCssExtractPlugin({ filename: 'css/[name].css' }),
  new MonacoWebpackPlugin({ filename: 'monaco-[name].[ext].js', languages: ['xml', 'json'] }),
  new WebpackBar({ color: isDev ? '#7e57c2' : '#9ccc65' }),
  new webpack.DefinePlugin({
    webpackEnv: {
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
  optimization: {
    emitOnErrors: isDev ? true : false,
    minimize: isDev ? false : true,
    minimizer: isDev ? [] : [new EsbuildPlugin({ css: true })],
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
      string_decoder: false,
      url: false,
    },
  },
  stats: isDev ? { children: true } : {},
  watch: isDev ? true : false,
};

webpackConfig.resolve?.fallback;

export default webpackConfig;
