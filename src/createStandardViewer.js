import { createViewer } from './createViewer.js'
import { mergeMessages } from './i18n/index.js'

/**
 * Build, wire up and mount a standard MWNF website in one call.
 *
 * Every website's `main.js` does the same three things after its own CSS
 * and locale imports: merge the shared dictionary its family pulls in
 * (`@museumwnf/viewer-i18n/{standalone|gallery|exhibition}`) under its own
 * `locales/*.json` overloads (local wins), hand the result and the site's
 * shell component to `createViewer()`, and mount the app. This helper does
 * those three steps, so `main.js` is left with only what genuinely cannot
 * move here:
 *
 * - its own CSS imports (`@museumwnf/viewer-layout/style.css`, the theme
 *   and site stylesheets) — Vite needs a static, site-relative specifier
 *   for each one, which only the site's own module can write;
 * - the `import.meta.glob('../locales/*.json', { eager: true })` loop that
 *   loads the site's own texts — a glob is resolved relative to the file
 *   that calls it, so run from inside this package it would look for
 *   `locales/` next to viewer-core, not next to the website.
 *
 * `viewer-core` does not depend on `@museumwnf/viewer-i18n`: that package's
 * three family dictionaries are independent subpath entry points precisely
 * so a website's bundle carries only the one it uses. Importing one of them
 * from here — or choosing between them at runtime from a string in
 * `config` — would either force every consumer to carry all three or
 * replace a bundler-time choice with one a bundler cannot tree-shake. The
 * website still imports its own family's `catalogues` and passes it as
 * `dictionary`.
 *
 * @param {object} config - the site's `dataset.config.js` object, exactly
 *   as passed to {@link createViewer} today
 * @param {object} [siteClass] - the site's `SiteShell` component, used as
 *   `config.shell` when `config` does not already set one (a config that
 *   still declares its own `shell` keeps taking precedence, so existing
 *   `dataset.config.js` files need no change)
 * @param {object} [options]
 * @param {object} [options.dictionary] - the family's shared catalogue,
 *   i.e. `catalogues` imported from
 *   `@museumwnf/viewer-i18n/{standalone|gallery|exhibition}`
 * @param {object} [options.ownMessages] - the website's own catalogue,
 *   already loaded (e.g. via the `import.meta.glob` loop above); merged
 *   over `dictionary` with {@link mergeMessages} — local wins. Used on its
 *   own, without a `dictionary`, when a website has no shared family text
 * @param {string|Element} [options.el] - the mount target, defaults to
 *   `'#app'`, exactly like every website's current `main.js`
 * @returns {import('vue').App} the mounted Vue application (call
 *   `.unmount()` on it, e.g. in a test)
 */
export function createStandardViewer(config, siteClass, options = {}) {
  const { dictionary, ownMessages, el = '#app' } = options

  const messages = dictionary
    ? mergeMessages(dictionary, ownMessages ?? {})
    : (config.messages ?? ownMessages ?? {})

  const app = createViewer({ ...config, shell: config.shell ?? siteClass, messages })
  app.mount(el)
  return app
}
