// Webpack config for building for production
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const SentryWebpackPlugin = require('@sentry/webpack-plugin');

module.exports = function (options) {
  const plugins = options.plugins || [];
  
  // Only add Sentry plugin if auth token is available
  if (process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(
      new SentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: "university-of-british-colum-p0",
        project: "helpme-nestjs",
      })
    );
  }
  
  return {
    ...options,
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    externals: [
      nodeExternals({
        allowlist: ['@koh/common'],
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
      ],
    },
    devtool: 'source-map',
    plugins: plugins,
    optimization: {
      emitOnErrors: false,
    },
  };
};
