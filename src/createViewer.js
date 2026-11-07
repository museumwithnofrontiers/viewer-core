import { createApp } from 'vue'
import AppRoot from './AppRoot.vue'
import { useDataPackage } from './composables/useDataPackage.js'
import { bindDisplayLanguage } from './displayLanguage.js'
import { createI18n } from './i18n/index.js'
import { connectLanguageToRouter, resolveInitialLanguage } from './i18n/language.js'
import { VIEWER_CONFIG } from './injectionKeys.js'
import { createViewerRouter } from './router/index.js'
import { setSiteConfig } from './siteConfig.js'
import { watchNewSiteLinks } from './legacySites.js'
import './styles/base.css'

export function createViewer(config = {}) {
  const { languages: datasetLanguages } = useDataPackage()
  const languages = config.languages ?? datasetLanguages
  const messages = config.messages ?? {}
  const resolved = { ...config, languages }

  const router = createViewerRouter(config)
  const i18n = createI18n({ messages, locale: resolveInitialLanguage(languages) })

  const app = createApp(AppRoot)
  setSiteConfig(resolved)
  app.provide(VIEWER_CONFIG, resolved)
  app.use(router)
  app.use(i18n)

  connectLanguageToRouter({ locale: i18n.locale, offered: languages, router })
  bindDisplayLanguage(i18n.locale)

  // Every link the site draws, its windows' included, goes to the new site
  // of a legacy address that has one (inventory-app#2482).
  const mount = app.mount.bind(app)
  const unmount = app.unmount.bind(app)
  let stopLinks = () => {}
  app.mount = (...args) => {
    const instance = mount(...args)
    stopLinks = watchNewSiteLinks(typeof document === 'undefined' ? null : document.body)
    return instance
  }
  app.unmount = () => {
    stopLinks()
    unmount()
  }

  return app
}
