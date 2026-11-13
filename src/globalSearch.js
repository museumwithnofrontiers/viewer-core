import { useSiteConfig } from './siteConfig.js'

// The global search (inventory-app M15, ADR 005): one search over every site's
// items, on a site of its own. A site opts in with `globalSearch` in its
// dataset.config.js, off by default:
//
//   globalSearch: true                                     // the default address
//   globalSearch: { url: 'https://example.org/search/' }   // another address
//
// The link carries the text, the language and this site's own slug as `from`,
// and nothing else: the search site accepts a slug only if it is in its list
// of sites, never an address, so no parameter can send a visitor elsewhere.

/** Where the search site is served, unless a site's config names another. */
export const GLOBAL_SEARCH_URL = 'https://museumwithnofrontiers.github.io/search/'

/** A site's slug: lowercase words joined by single hyphens, as the exporters' instance files. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LANGUAGE = /^[a-z]{2}$/

function searchBase(setting) {
  if (setting === true) return GLOBAL_SEARCH_URL
  if (setting && typeof setting === 'object' && typeof setting.url === 'string') {
    let url
    try {
      url = new URL(setting.url)
    } catch {
      return null
    }
    if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) return null
    return url.href.endsWith('/') ? url.href : `${url.href}/`
  }
  return null
}

/**
 * This site's slug: `site.slug` when declared, else the last segment of
 * `site.origin` (every site is served one path segment under a common
 * parent). Null when neither gives a valid slug.
 */
export function siteSlug(config = useSiteConfig()) {
  const declared = config?.site?.slug
  if (typeof declared === 'string') return SLUG.test(declared) ? declared : null
  const origin = String(config?.site?.origin ?? '').replace(/\/+$/, '')
  const last = origin.slice(origin.lastIndexOf('/') + 1)
  return SLUG.test(last) ? last : null
}

/**
 * The address of the global search for `q` in `lang`, or null when the site
 * has not opted in. Built only from the configured address and the escaped
 * parameters.
 */
export function globalSearchUrl({ q = '', lang = '' } = {}, config = useSiteConfig()) {
  const base = searchBase(config?.globalSearch)
  if (!base) return null
  const params = new URLSearchParams()
  const text = String(q ?? '').trim()
  if (text) params.set('q', text)
  if (LANGUAGE.test(String(lang))) params.set('lang', String(lang))
  const from = siteSlug(config)
  if (from) params.set('from', from)
  const query = params.toString()
  return `${base}#/${query ? `?${query}` : ''}`
}

/** For a component: whether the site has opted in, and the link builder. */
export function useGlobalSearch() {
  const config = useSiteConfig()
  return {
    enabled: searchBase(config?.globalSearch) !== null,
    url: (q, lang) => globalSearchUrl({ q, lang }, config),
  }
}
