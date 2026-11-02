import path from 'node:path'

/**
 * The shared Vite configuration for viewer websites, returning a config object
 * ready to pass to `defineConfig()`. The seven websites duplicate this shape:
 * the `@inventory-data` alias to the data package, `optimizeDeps` to inline
 * the viewer packages, `testTimeout`, and the test environment.
 *
 * `dataPackage` is the npm package name, e.g. `'@museumwnf/islamicart-data'`.
 * `inline` is an optional array of extra packages to inline in tests, beyond
 * the required `'@museumwnf/viewer-core'` and `'@museumwnf/viewer-layout'`.
 * `plugins` is an optional array of Vite plugins (e.g. `@vitejs/plugin-vue`),
 * which the site must supply because this package does not depend on them.
 * `root` is an optional project root path (default `process.cwd()`); use it when
 * loading the config from a context other than the project directory.
 */
export function defineViewerConfig({
  dataPackage,
  inline = [],
  plugins = [],
  root = process.cwd(),
} = {}) {
  return {
    plugins,
    resolve: {
      alias: {
        // viewer-core reads every JSON of the data package through this alias.
        // Resolve against the caller's project root, not this file's installed
        // location: import.meta.url is the package's own path inside node_modules,
        // not the site's project root where its node_modules actually exists.
        '@inventory-data': path.join(root, 'node_modules', dataPackage),
      },
    },
    optimizeDeps: {
      // viewer-core ships .vue source that esbuild pre-bundling cannot parse;
      // viewer-layout must not be pre-bundled either or its chunk gets a second
      // copy of the Vue runtime in dev (both packages share the app's vue).
      // The /i18n subpath is listed as well as the package: Vite pre-bundles a
      // subpath as its own entry, and a second copy of the text module would be
      // a second, empty set of texts for whatever imported it.
      exclude: [
        '@museumwnf/viewer-core',
        '@museumwnf/viewer-core/i18n',
        '@museumwnf/viewer-layout',
      ],
      // The runtime deps reach the browser through those excluded packages, so
      // the dev-server dependency scan cannot discover them until the website's
      // own views import them directly. Without this list a late discovery
      // pre-bundles a second copy of Vue next to the raw one already loaded,
      // and the dev server crashes on boot. Listing them pre-bundles each
      // exactly once, and the excluded packages get the same copy.
      include: ['vue', 'vue-router'],
    },
    test: {
      environment: 'jsdom',
      testTimeout: 60000,
      // Node 26 has a `localStorage` of its own, which hides jsdom's from the
      // tests: without a storage file it is undefined.
      execArgv: ['--no-experimental-webstorage'],
      server: {
        deps: {
          // viewer-core ships .vue source; Node cannot load it unless Vitest
          // processes the package instead of externalizing it, matched by the
          // specifier the *importing site* actually wrote. viewer-layout's
          // composed views import viewer-core, so the layout is processed too.
          inline: [
            '@museumwnf/viewer-core',
            '@museumwnf/viewer-layout',
            ...inline,
          ],
        },
      },
    },
  }
}
