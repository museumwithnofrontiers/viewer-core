import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mwnfLinks } from '../src/conventions.js'
import { setSiteConfig } from '../src/siteConfig.js'
import { siblingSiteUrl, sourceUrl, useSiteRights } from '../src/rights.js'

// useSiteRights reads the one manifest the whole suite shares through the
// @inventory-data alias, which carries no `rights` block (it predates
// inventory-app#1690) — mocking the composable is the only way to exercise
// the "package declares a block" branch without changing what every other
// test file loads.
const state = vi.hoisted(() => ({ manifest: {} }))
vi.mock('../src/composables/useDataPackage.js', () => ({
  useDataPackage: () => ({ manifest: state.manifest }),
}))

describe('useSiteRights', () => {
  it('reads the holder, terms address and attribution from the rights block', () => {
    state.manifest = {
      rights: {
        rights_holder: 'Musée fictif',
        terms_url: 'https://example.org/terms',
        attribution: 'Photo: Fixture Museum',
      },
    }
    expect(useSiteRights()).toEqual({
      holder: 'Musée fictif',
      termsUrl: 'https://example.org/terms',
      attribution: 'Photo: Fixture Museum',
    })
  })

  it('falls back to the MWNF legal notice, with no holder or attribution, for a package with no rights block', () => {
    state.manifest = {}
    expect(useSiteRights()).toEqual({ holder: null, termsUrl: mwnfLinks.legalNotice, attribution: null })
  })
})

describe('sourceUrl', () => {
  it('is null when the site declares no origin', () => {
    setSiteConfig({})
    expect(sourceUrl({ fullPath: '/item/o1' })).toBeNull()
  })

  it('composes the declared origin, the base-path slash, and the route’s hash address', () => {
    setSiteConfig({ site: { origin: 'https://metanull.github.io/islamicart' } })
    expect(sourceUrl({ fullPath: '/item/o1' })).toBe('https://metanull.github.io/islamicart/#/item/o1')
  })

  it('reads an already-resolved route’s fullPath directly, without needing a router at hand', () => {
    setSiteConfig({ site: { origin: 'https://example.org/site' } })
    // No router is installed anywhere in this test — resolving would throw.
    expect(sourceUrl({ fullPath: '/' })).toBe('https://example.org/site/#/')
  })

  it('tolerates a misdeclared trailing slash on the origin', () => {
    setSiteConfig({ site: { origin: 'https://example.org/site/' } })
    expect(sourceUrl({ fullPath: '/item/o1' })).toBe('https://example.org/site/#/item/o1')
  })

  it('resolves a raw named location through the installed router', () => {
    setSiteConfig({ site: { origin: 'https://example.org/site' } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<p />' } },
        { path: '/item/:id', name: 'item-detail', component: { template: '<p />' } },
      ],
    })
    let result
    mount(
      { setup() { result = sourceUrl({ name: 'item-detail', params: { id: 'o1' } }); return () => null } },
      { global: { plugins: [router] } },
    )
    expect(result).toBe('https://example.org/site/#/item/o1')
  })

  it('resolves a raw path string the same way', () => {
    setSiteConfig({ site: { origin: 'https://example.org/site' } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/item/:id', name: 'item-detail', component: { template: '<p />' } }],
    })
    let result
    mount({ setup() { result = sourceUrl('/item/o2'); return () => null } }, { global: { plugins: [router] } })
    expect(result).toBe('https://example.org/site/#/item/o2')
  })
})

describe('siblingSiteUrl', () => {
  it("swaps the origin's last segment for the sibling's slug", () => {
    setSiteConfig({ site: { origin: 'https://example.org/ceramics/' } })
    expect(siblingSiteUrl('islamicart', '/item/o1')).toBe('https://example.org/islamicart/#/item/o1')
  })

  it('is null with no origin or no slug', () => {
    setSiteConfig({})
    expect(siblingSiteUrl('islamicart', '/item/o1')).toBeNull()
    setSiteConfig({ site: { origin: 'https://example.org/ceramics' } })
    expect(siblingSiteUrl(null, '/item/o1')).toBeNull()
  })
})
