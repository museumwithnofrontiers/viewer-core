import { beforeAll, describe, expect, it } from 'vitest'
import { createViewer, loadEntities } from '../../src/index.js'
import { useGalleryData } from '../../src/dxa/gallery/useGalleryData.js'
import { messages } from '../fixtures/messages.js'

// The gallery data layer, against the shared fixture package (extended with
// items/tags/dynasties/gallery for this epic — see tests/fixtures/data-package).

beforeAll(async () => {
  createViewer({
    datasetPackage: '@museumwnf/fixture-data',
    siteName: 'Fixture Museum',
    messages,
    media: { legacyHost: 'https://images.example.org' },
  })
  await loadEntities(['items', 'partners', 'countries', 'tags', 'dynasties', 'gallery'])
})

describe('useGalleryData', () => {
  it('reads the installed manifest and exposes the base language', () => {
    const data = useGalleryData()
    expect(data.defaultLang).toBe('en')
    expect(data.manifest.dataset).toBe('fixture')
  })

  it('labels a record from its translation, falling back to internal_name', async () => {
    const data = useGalleryData()
    await data.loadEnglish()
    expect(data.labelOf('items', 'item-1')).toBe('Glazed bowl')
    // item-2 carries no en translation but its own internal_name.
    expect(data.labelOf('items', 'item-2')).toBe('Mosque lamp')
  })

  it('builds the canonical item and partner routes', () => {
    const data = useGalleryData()
    expect(data.itemRoute({ id: 'item-1' })).toEqual({ name: 'item', params: { id: 'item-1' } })
    expect(data.partnerRoute({ id: 'partner-fr-owner' })).toEqual({ name: 'partner', params: { id: 'partner-fr-owner' } })
    expect(data.partnerObjectsRoute({ id: 'partner-fr-owner' }, 2)).toEqual({
      name: 'partner-objects', params: { id: 'partner-fr-owner' }, query: { page: 2 },
    })
  })

  it('resolves the legacy dbUid path back to its item', () => {
    const data = useGalleryData()
    expect(data.itemFromUidPath('mwnf3/objects/Obj1/eg')?.id).toBe('item-1')
    expect(data.itemFromUidPath('nope/nope')).toBeNull()
  })

  it('resolves a partner from its legacy country code and id', () => {
    const data = useGalleryData()
    // partner-fr-owner has no backward_compatibility in the fixture, and its
    // own country_id (`country-fr`) is not one of countries.json's ids, so
    // the legacy/index.js fallback resolves an empty country code, with the
    // partner's own id as the legacy id.
    expect(data.partnerFromKey('', 'partner-fr-owner')?.id).toBe('partner-fr-owner')
    expect(data.partnerFromKey('', 'nope')).toBeNull()
  })

  it('builds a legacy media address from the site config host', () => {
    const data = useGalleryData()
    expect(data.chromeImage('galleries/g1/banner.jpg')).toBe('https://images.example.org/hi_res/galleries/g1/banner.jpg')
    expect(data.chromeImage(null)).toBeNull()
  })

  it('filters out a hidden sibling gallery and links only those with a legacy host', () => {
    const data = useGalleryData()
    expect(data.siblingGalleries.value.map((g) => g.id)).toEqual(['sib-1', 'sib-2'])
    expect(data.siblingUrl({ legacy_host: 'https://x.example.org' })).toBe('https://x.example.org')
    expect(data.siblingUrl({ legacy_host: null })).toBeNull()
  })

  it('picks siblings without exceeding the visible pool', () => {
    const data = useGalleryData()
    const picked = data.pickSiblings(4)
    expect(picked.length).toBe(2)
    expect(picked.every((g) => ['sib-1', 'sib-2'].includes(g.id))).toBe(true)
  })
})
