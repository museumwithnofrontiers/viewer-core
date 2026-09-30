import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  applyDocumentLanguage,
  connectLanguageToRouter,
  isRtl,
  negotiateLanguage,
  readStoredLanguage,
  storeLanguage,
} from '../src/i18n/language.js'

describe('negotiateLanguage', () => {
  const offered = ['en', 'fr', 'ar']

  it('prefers what the URL asks for', () => {
    expect(negotiateLanguage(offered, { requested: 'fr', stored: 'ar' })).toBe('fr')
  })

  it('then the visitor’s remembered choice', () => {
    expect(negotiateLanguage(offered, { stored: 'ar', preferred: ['fr'] })).toBe('ar')
  })

  it('then what the browser asks for, in its own order', () => {
    expect(negotiateLanguage(offered, { preferred: ['de', 'ar', 'fr'] })).toBe('ar')
  })

  it('matches a regional code against the language offered', () => {
    expect(negotiateLanguage(offered, { preferred: ['fr-CA'] })).toBe('fr')
  })

  it('falls back to English', () => {
    expect(negotiateLanguage(offered, { preferred: ['de'] })).toBe('en')
  })

  it('never selects a language the website does not offer', () => {
    expect(negotiateLanguage(['fr', 'ar'], { requested: 'de', stored: 'it' })).toBe('fr')
  })

  it('survives a website that declares nothing', () => {
    expect(negotiateLanguage([])).toBe('en')
  })
})

describe('text direction', () => {
  it('knows the right-to-left languages, region included', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('ar-EG')).toBe(true)
    expect(isRtl('fr')).toBe(false)
  })

  it('sets lang and dir on the document', () => {
    applyDocumentLanguage('ar')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    applyDocumentLanguage('en')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
  })
})

describe('the remembered choice', () => {
  beforeEach(() => localStorage.clear())

  it('survives a round trip', () => {
    storeLanguage('fr')
    expect(readStoredLanguage()).toBe('fr')
  })

  it('reads as nothing when storage is unavailable', () => {
    const storage = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    expect(readStoredLanguage()).toBe(null)
    expect(() => storeLanguage('fr')).not.toThrow()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  })
})

describe('the language in the URL', () => {
  beforeEach(() => localStorage.clear())

  const Page = { render: () => null }

  // A multilingual website's router, opened on `/a`. `/slow` loads its page
  // only when the test lets it, so a navigation can be caught under way.
  async function connect() {
    let release
    const loading = new Promise((resolve) => (release = () => resolve(Page)))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/a', component: Page },
        { path: '/b', component: Page },
        { path: '/slow', component: () => loading },
      ],
    })
    const locale = ref('en')
    connectLanguageToRouter({ locale, offered: ['en', 'fr', 'de'], router })
    await router.push('/a')
    return { router, locale, release }
  }

  it('is added to the first page', async () => {
    const { router } = await connect()
    expect(router.currentRoute.value.fullPath).toBe('/a?lang=en')
  })

  it('follows the visitor switching language', async () => {
    const { router, locale } = await connect()
    locale.value = 'de'
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/a?lang=de'))
  })

  it('changes with the page when a link names both', async () => {
    // The guard switches the language for the page the link names. The
    // language watcher used to rewrite the URL of the page being left before
    // that navigation landed, which cancelled it: the visitor stayed where
    // they were, in the new language.
    const { router, locale } = await connect()
    await router.push('/b?lang=fr')
    await vi.waitFor(() => expect(router.currentRoute.value.query.lang).toBe('fr'))
    expect(router.currentRoute.value.path).toBe('/b')
    expect(locale.value).toBe('fr')
  })

  it('keeps a language the visitor switches to while a page loads', async () => {
    const { router, locale, release } = await connect()
    const arriving = router.push('/slow')
    await new Promise((resolve) => setTimeout(resolve))
    locale.value = 'de'
    await new Promise((resolve) => setTimeout(resolve))
    release()
    await arriving
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/slow?lang=de'))
  })
})
