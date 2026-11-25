// Webpack with hot module reloading for use in development
// Hot module reloading supposedly lets us reload the server faster
// https://docs.nestjs.com/recipes/hot-reload

const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const StartServerPlugin = require('razzle-start-server-webpack-plugin');

module.exports = function (options) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    watch: true,
    // A burst of saves (for example a refactor across several files) should
    // produce one rebuild. Rebuilding while a restart is already in flight is
    // what used to leave the old server running and stop serving new code.
    watchOptions: {
      aggregateTimeout: 750,
    },
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100', '@koh/common'],
        additionalModuleDirs: [path.resolve(__dirname, '../../node_modules')], // handle yarn workspaces https://github.com/liady/webpack-node-externals/issues/39
      }),
    ],
    module: {
      rules: [
        {
          test: /.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /.tsx?$/,
          use: 'ts-loader',
          include: /@koh/, // Build packages we depend on
        },
        {
          test: /\.md$/,
          type: 'asset/source', // allows us to import .md files into our typescript rather than requiring to read them at runtime
        },
      ],
    },
    devtool: 'source-map',
    plugins: [
      ...(options.plugins || []),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
      // Restart the whole server on each successful rebuild. Nest's in-place
      // HMR can fail to register new routes/providers, and once it hits that
      // state it stops restarting at all. A hard restart is slower but always
      // serves the code that was just compiled.
      new StartServerPlugin({ signal: 'SIGTERM' }),
    ],
    optimization: {
      emitOnErrors: false,
    },
  };
};
