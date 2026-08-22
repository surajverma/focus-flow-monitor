const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Terser = require('terser');
const { version } = require('./package.json'); // Make sure to use the version

module.exports = (env, argv) => {
  const requestedTarget = env?.target;
  // Determine if it's a production build. This will be used for JS transformation.
  const isProduction = argv.mode === 'production';

  // Define common JavaScript transformation logic
  const jsTransform = isProduction
    ? async (content, absoluteFrom) => {
        try {
          const result = await Terser.minify(content.toString(), {
            mangle: false,
            compress: {
              drop_console: true,
            },
            format: {
              comments: false,
              beautify: true,
            },
          });
          if (result.error) {
            console.error(`Terser error processing ${absoluteFrom}:`, result.error);
            return content;
          }
          return result.code;
        } catch (error) {
          console.error(`Error processing ${absoluteFrom}:`, error);
          return content;
        }
      }
    : (content) => content;

  // Define common patterns for CopyPlugin
  // Files/folders to exclude from the build output should be removed from here
  // or handled by ignore patterns in broader globs.
  const commonAssetPatterns = [
    { from: 'popup/popup.html', to: 'popup/' },
    { from: 'options/options.html', to: 'options/' },
    { from: 'blocked/blocked.html', to: 'blocked/' },
    { from: 'popup/popup.css', to: 'popup/' },
    { from: 'options/options.css', to: 'options/' },
    { from: 'blocked/blocked.css', to: 'blocked/' },
    { from: 'libs/chart.umd.js', to: 'libs/' }, // Specifically include libs
    { from: 'icons/*.png', to: 'icons/[name][ext]' },
    { from: 'data/default_config.json', to: 'data/' },
    // README.md and updates.json are removed from here to exclude them from the build output.
    // If updates.json is needed for self-hosted beta, it should only be in betaConfig.
    // Common JS files (will be transformed based on isProduction)
    {
      from: '**/*.js',
      context: '.', // Relative to the project root
      to: '.', // Copy maintaining the directory structure
      globOptions: {
        ignore: [
          '**/node_modules/**',
          '**/libs/**',
          '**/scripts/**',
          '**/dist/**',
          '**/*.test.js',
          '**/.eslintrc.js',
          '**/eslint.config.js',
          '**/jest.config.js',
          '**/jest.setup.js',
          '**/webpack.config.js',
          '**/updates.json',
          '**/src/core/limits.js',
          '**/src/core/storage-init.js',
          '**/src/popup/quick-actions.js',
        ],
      },
      transform: jsTransform,
      info: {
        minimized: isProduction,
      },
    },
  ];

  // Base configuration applicable to both builds
  const baseConfig = {
    mode: isProduction ? 'production' : 'development',
    entry: {},
    optimization: {
      minimize: false,
    },
    devtool: false,
    module: {},
    performance: {
      hints: false,
    },
    stats: 'minimal',
  };

  // Configuration for the "Beta" release (GitHub)
  const betaPatterns = [
    ...commonAssetPatterns,
    { from: 'updates.json', to: '.' }, // Specifically include updates.json only for beta
  ];
  const betaConfig = {
    ...baseConfig,
    name: 'betaConfig',
    output: {
      path: path.resolve(__dirname, 'dist/beta'),
      filename: 'dummy.beta.[name].js',
      clean: true, // Cleans dist/beta before build
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest-beta.json',
            to: 'manifest.json',
            // transform: (content) => {
            //   const manifest = JSON.parse(content.toString());
            //   manifest.version = version;
            //   return JSON.stringify(manifest, null, 2);
            // }
          },
          ...betaPatterns, // Use patterns specific to beta build
        ],
      }),
    ],
  };

  // Configuration for the "Release" (AMO/Public)
  // README.md and updates.json are not included here by default
  const releaseConfig = {
    ...baseConfig,
    name: 'releaseConfig',
    output: {
      path: path.resolve(__dirname, 'dist/release'),
      filename: 'dummy.release.[name].js',
      clean: true, // Cleans dist/release before build
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest.json', // Source for public/AMO manifest
            to: 'manifest.json',
            // transform: (content) => {
            //   const manifest = JSON.parse(content.toString());
            //   manifest.version = version;
            //   return JSON.stringify(manifest, null, 2);
            // }
          },
          ...commonAssetPatterns, // commonAssetPatterns no longer includes README or updates.json
        ],
      }),
    ],
  };

  // Conditionally export configuration based on package.json version
  const versionParts = version.split('.');
  if (requestedTarget === 'release') {
    console.log(`Building RELEASE target using manifest version ${releaseConfig.plugins[0].patterns[0].from}.`);
    return [releaseConfig];
  } else if (requestedTarget === 'beta' || versionParts.length === 4) {
    console.log(`Building BETA version (${version}) only, outputting to dist/beta.`);
    return [betaConfig];
  } else if (versionParts.length === 3) {
    console.log(`Building RELEASE version (${version}) only, outputting to dist/release.`);
    return [releaseConfig];
  } else {
    console.warn(
      `WARNING: Version format (${version}) in package.json is not 3 or 4 digits.
Please use format X.Y.Z for releases and X.Y.Z.B for betas.
Building both configurations as a fallback.`
    );
    return [betaConfig, releaseConfig];
  }
};
