import { watch } from 'vue'
import { START_LOCATION } from 'vue-router'

// Which language a visitor gets, decided once, in one place.
//
// Before this, a website opened at `languages[0]` and stayed there: no
// negotiation, no memory between visits, nothing in the URL, and no `lang` or
// `dir` on the document — so a right-to-left language rendered left to right.

const STORAGE_KEY = 'mwnf.language'

export const RTL_LANGUAGES = new Set([
  'ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi',
])

export function isRtl(code) {
  return RTL_LANGUAGES.has(String(code ?? '').toLowerCase().split('-')[0])
}

/**
 * The URL first, then the visitor's own earlier choice, then what their
 * browser asks for, then English. A language that is not offered is ignored at
 * every step, so nothing here can select a language the website does not have.
 */
export function negotiateLanguage(offered, { requested, stored, preferred = [] } = {}) {
  const list = offered?.length ? offered : ['en']
  const match = (code) => {
    if (!code) return undefined
    const wanted = String(code).toLowerCase()
    return (
      list.find((candidate) => candidate.toLowerCase() === wanted) ??
      list.find((candidate) => candidate.toLowerCase().split('-')[0] === wanted.split('-')[0])
    )
  }
  return (
    match(requested) ??
    match(stored) ??
    preferred.map(match).find(Boolean) ??
    match('en') ??
    list[0]
  )
}

export function readStoredLanguage() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    // A browser refusing storage is not a reason to fail to render a page.
    return null
  }
}

export function storeLanguage(code) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, code)
  } catch {
    /* see readStoredLanguage */
  }
}

export function applyDocumentLanguage(code) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('lang', code)
  document.documentElement.setAttribute('dir', isRtl(code) ? 'rtl' : 'ltr')
}

function browserLanguages() {
  if (typeof navigator === 'undefined') return []
  return navigator.languages ?? (navigator.language ? [navigator.language] : [])
}

/**
 * The language to start in, before the router has resolved a route. The URL is
 * deliberately not read here — the router owns it, and reading it twice is how
 * the two disagree.
 */
export function resolveInitialLanguage(offered) {
  return negotiateLanguage(offered, {
    stored: readStoredLanguage(),
    preferred: browserLanguages(),
  })
}

/**
 * On a website offering more than one language the URL is the source of truth:
 * `?lang=` carries it, so a page can be linked, bookmarked and shared in the
 * language it was read in. A single-language website never gets the parameter.
 *
 * It is a query parameter rather than a path segment because the legacy routes
 * these websites reproduce are matched by path: prefixing them would break
 * every URL that has ever been published.
 */
export function connectLanguageToRouter({ locale, offered, router }) {
  const multilingual = offered.length > 1

  // The navigation under way, from the guard until it lands. Its URL already
  // carries the language the guard set; rewriting the page being left
  // instead cancels it, and the visitor stays there in the new language.
  let pending = null
  const settle = (to) => {
    if (pending === to) pending = null
  }

  router.beforeEach((to) => {
    pending = to
    const next = negotiateLanguage(offered, {
      requested: multilingual ? to.query.lang : undefined,
      stored: readStoredLanguage(),
      preferred: browserLanguages(),
    })
    if (locale.value !== next) locale.value = next
    if (multilingual && to.query.lang !== next) {
      // Resolves on the second pass, when the query already says `next`.
      return { ...to, query: { ...to.query, lang: next }, replace: true }
    }
    return true
  })

  router.afterEach((to, from, failure) => {
    settle(to)
    // The visitor switched language while this page loaded.
    if (!failure && multilingual && to.query.lang !== locale.value) {
      router.replace({ query: { ...to.query, lang: locale.value } })
    }
  })
  router.onError((error, to) => settle(to))

  // A change of language from the switcher rewrites the URL. Not while a
  // navigation is under way (see `pending`), and so not before the first one
  // has resolved: the router is then still at its start location, `/`, and a
  // replace from there cancels the navigation the visitor arrived with, so
  // every deep link landed on the home page. The guard above puts the
  // language in the URL of that first navigation itself.
  watch(
    locale,
    (code) => {
      applyDocumentLanguage(code)
      storeLanguage(code)
      const current = router.currentRoute.value
      if (multilingual && !pending && current !== START_LOCATION && current.query.lang !== code) {
        router.replace({ query: { ...current.query, lang: code } })
      }
    },
    { immediate: true }
  )
}
