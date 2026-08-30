import {withSentryConfig} from "@sentry/nextjs";

import injectWhyDidYouRender from './scripts/why-did-you-render/index.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // disabled since it messes with antd forms unfortunately
  experimental: {
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    loader: 'custom',
    loaderFile: './loader.js',
    // remotePatterns is a list of where all of our images can come from. It is needed otherwise malicious users can use our server to optimize their own images
    remotePatterns: [
      {
        // allow images from the same host
        protocol: process.env.NEXT_PUBLIC_HOST_PROTOCOL,
        hostname: process.env.NEXT_PUBLIC_HOSTNAME,
        port: process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' ? process.env.NEXT_PUBLIC_DEV_PORT : '',
      },
      {
        // allow images from google
        protocol: 'https',
        port: '',
        hostname: '*.googleusercontent.com',
        pathname: '**'
      }
    ],
  },
  // NOTE: why-did-you-render uses a custom Webpack config, which is IGNORED when using Turbopack (the default in Next.js 16).
  // To enable why-did-you-render for deep React debugging:
  //   1. Change your dev script in package.json from "next dev" to "next dev --webpack"
  //   2. Set NEXT_PUBLIC_WHY_DID_YOU_RENDER=true in your .env
  //   3. Run `yarn dev` as usual — it will use Webpack instead of Turbopack
  //   Remember to revert the dev script when done debugging.
  webpack: (config, context) => {
    if (process.env.NEXT_PUBLIC_WHY_DID_YOU_RENDER === 'true') {
      injectWhyDidYouRender(config, context)
    }
    return config;
  }
};

export default withSentryConfig(nextConfig, {
// For all available options, see:
// https://github.com/getsentry/sentry-webpack-plugin#options

org: "university-of-british-colum-p0",
project: "helpme",
sentryUrl: "https://sentry.io/",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Automatically annotate React components to show their full name in breadcrumbs and session replay
reactComponentAnnotation: {
enabled: true,
},

// Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js proxy, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/sentry-tunnel",

// Hides source maps from generated client bundles
hideSourceMaps: true,

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/product/crons/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});