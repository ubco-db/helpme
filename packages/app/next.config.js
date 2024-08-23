const withTM = require("next-transpile-modules")([
  "@koh/app",
  "@koh/common",
  "@koh/api-client",
]);
const withPlugins = require("next-compose-plugins");
const withOffline = require("next-offline");

// Next doesn't allow node modules to import their own CSS, but the fullcal library does that.
// this is a workaround.
const { withGlobalCss } = require('next-global-css');
const { patchWebpackConfig } = require('next-global-css');

const plugins = [withTM, withOffline, withGlobalCss];

const SentryWebpackPlugin = require("@sentry/webpack-plugin");

const {
  NEXT_PUBLIC_SERVICE_VERSION: SERVICE_VERSION,
  SENTRY_AUTH_TOKEN,
  NODE_ENV,
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
} = process.env;

const SENTRY_DSN =
  "https://9cfb47804c93495ba3a66a9d79cec084@o440615.ingest.sentry.io/5557379";

const config = {
  // dangerous
  typescript: {
    ignoreBuildErrors: true,
  },
  i18n: { // speaking language configuration
    locales: ["en"],
    defaultLocale: "en",
  },
  webpack: (config, options) => {
    patchWebpackConfig(config, options)

    // Webpack to replace @sentry/node imports with @sentry/browser when
    // building the browser's bundle
    if (!options.isServer) {
      config.resolve.alias["@sentry/node"] = "@sentry/browser";
    }
    if (
      (SERVICE_VERSION,
        SENTRY_DSN,
        SENTRY_AUTH_TOKEN && NODE_ENV === "sentryEnabled")
    ) {
      config.plugins.push(
        new SentryWebpackPlugin({
          org: "sandboxnu",
          project: "khoury-office-hours-frontend",
          include: ".next",
          ignore: ["node_modules"],
          urlPrefix: "~/_next",
          release: SERVICE_VERSION,
        })
      );
    }
    return config;
  },
  webpack5: false
};

module.exports = withPlugins(plugins, config);
