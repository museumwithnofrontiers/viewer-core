import { describe, expect, it } from 'vitest'
import { GLOBAL_SEARCH_URL, globalSearchUrl, siteSlug } from '../src/globalSearch.js'

const site = (extra = {}) => ({ site: { origin: 'https://museumwithnofrontiers.github.io/ceramics' }, ...extra })

describe('globalSearchUrl', () => {
  it('is off unless the site opts in', () => {
    expect(globalSearchUrl({ q: 'mihrab' }, site())).toBeNull()
    expect(globalSearchUrl({ q: 'mihrab' }, site({ globalSearch: false }))).toBeNull()
  })

  it("carries the text, the language and the site's own slug", () => {
    expect(globalSearchUrl({ q: 'mihrab', lang: 'ar' }, site({ globalSearch: true }))).toBe(
      `${GLOBAL_SEARCH_URL}#/?q=mihrab&lang=ar&from=ceramics`
    )
  })

  it('escapes the text and drops a language that is not a code', () => {
    const url = globalSearchUrl({ q: ' a&b=<c> ', lang: 'javascript:' }, site({ globalSearch: true }))
    expect(url).toBe(`${GLOBAL_SEARCH_URL}#/?q=a%26b%3D%3Cc%3E&from=ceramics`)
  })

  it('opens the search page itself with no text', () => {
    expect(globalSearchUrl({}, site({ globalSearch: true }))).toBe(`${GLOBAL_SEARCH_URL}#/?from=ceramics`)
  })

  it('takes another https address, and refuses anything else', () => {
    expect(globalSearchUrl({ q: 'x' }, site({ globalSearch: { url: 'https://example.org/search' } }))).toBe(
      'https://example.org/search/#/?q=x&from=ceramics'
    )
    for (const url of ['http://example.org/', 'javascript:alert(1)', 'https://example.org/?x=1', 'nonsense']) {
      expect(globalSearchUrl({ q: 'x' }, site({ globalSearch: { url } }))).toBeNull()
    }
  })

  it('leaves out a slug it cannot be sure of', () => {
    const config = { site: { origin: 'https://www.example.org' }, globalSearch: true }
    expect(globalSearchUrl({ q: 'x' }, config)).toBe(`${GLOBAL_SEARCH_URL}#/?q=x`)
  })
})

describe('siteSlug', () => {
  it('reads site.slug, else the last segment of the origin', () => {
    expect(siteSlug({ site: { slug: 'islamicart', origin: 'https://islamicart.example' } })).toBe('islamicart')
    expect(siteSlug(site())).toBe('ceramics')
    expect(siteSlug({ site: { origin: 'https://museumwithnofrontiers.github.io/the-table-is-set/' } })).toBe('the-table-is-set')
    expect(siteSlug({ site: { slug: 'Not A Slug' } })).toBeNull()
    expect(siteSlug({})).toBeNull()
  })
})
