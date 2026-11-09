import { beforeAll, describe, expect, it } from 'vitest'
import { createViewer, loadEntities } from '../../src/index.js'
import { useExhibitionData } from '../../src/dxa/exhibition/useExhibitionData.js'
import { messages } from '../fixtures/messages.js'

// The exhibition data layer, against the shared fixture package (extended
// with items/tags/dynasties/exhibition for this epic).

beforeAll(async () => {
  createViewer({
    datasetPackage: '@museumwnf/fixture-data',
    siteName: 'Fixture Museum',
    messages,
    media: { legacyHost: 'https://images.example.org' },
  })
  await loadEntities(['items', 'partners', 'countries', 'tags', 'dynasties', 'exhibition'])
})

describe('useExhibitionData', () => {
  it('drops a record whose languages array excludes this build, keeps one with none at all', async () => {
    const data = useExhibitionData()
    await data.loadEnglish()
    const ids = data.items.value.map((i) => i.id)
    // item-3 carries only `fr` — legacy 404s it on an `en` build.
    expect(ids).toContain('item-1')
    expect(ids).toContain('item-2') // languages: [] — a package gap, not a rule
    expect(ids).not.toContain('item-3')
    expect(data.itemById.value.has('item-3')).toBe(false)
  })

  it('hides a partner named in hidden_partner_ids from the visible list, but not from lookup', () => {
    const data = useExhibitionData()
    const visibleIds = data.visiblePartners.value.map((p) => p.id)
    expect(visibleIds).not.toContain('partner-de-plain')
    expect(visibleIds).toContain('partner-fr-owner')
    expect(data.isHiddenPartner({ id: 'partner-de-plain' })).toBe(true)
    expect(data.isHiddenPartner({ id: 'partner-fr-owner' })).toBe(false)
    // The unfiltered lookup still resolves the hidden museum's own name.
    expect(data.partnerById.value.get('partner-de-plain')).toBeTruthy()
  })

  it('lists no partner the package says has no text in any language, as legacy listed none (The Hijaz Railway lb/Mon91)', () => {
    const data = useExhibitionData()
    expect(data.partnerById.value.get('partner-lb-nameless')).toBeTruthy()
    expect(data.visiblePartners.value.map((p) => p.id)).not.toContain('partner-lb-nameless')
    expect(data.visiblePartnerById('partner-lb-nameless')).toBeNull()
    expect(data.isHiddenPartner(data.partnerById.value.get('partner-lb-nameless'))).toBe(true)
    // A partner whose package row carries no languages field at all stays.
    expect(data.visiblePartnerById('partner-fr-owner')).toBeTruthy()
  })

  it('reads the exhibition\'s own per-language chrome text, falling back to English', () => {
    const data = useExhibitionData()
    expect(data.exhibitionTitle()).toBe('Fixture Exhibition')
    expect(data.exhibitionTitle('de')).toBe('Fixture Exhibition')
    expect(data.exhibitionSubtitle()).toBe('A fixture')
    expect(data.exhibitionHeadline()).toBe('Welcome')
    expect(data.bannerCaption()).toBe('Banner')
  })

  it('names a record\'s source project from the manifest, and nothing for an Explore record', () => {
    const data = useExhibitionData()
    // tests/fixtures/data-package/manifest.json carries no `projects`
    // section, so every record — including the Explore one — reads null.
    expect(data.projectName({ project_id: 'proj-a' })).toBeNull()
    expect(data.isExploreRecord({ backward_compatibility: 'mwnf3_explore:objects:Obj2' })).toBe(true)
    expect(data.isExploreRecord({ backward_compatibility: 'mwnf3:objects:Obj1:eg' })).toBe(false)
  })

  it('routes a museum and an institution partner differently', () => {
    const data = useExhibitionData()
    const institution = { id: 'p1', type: 'institution', backward_compatibility: 'mwnf3:institutions:Mon01:sy' }
    expect(data.isInstitution(institution)).toBe(true)
    expect(data.isInstitution({ type: 'museum', backward_compatibility: 'mwnf3:museums:Mus01:eg' })).toBe(false)
    expect(data.partnerRoute(institution)).toEqual({ name: 'institution', params: { id: 'p1' } })
    expect(data.partnerRoute({ id: 'p1', type: 'museum' })).toEqual({ name: 'partner', params: { id: 'p1' } })
    expect(data.partnerObjectsRoute(institution, 2)).toEqual({
      name: 'institution-monuments', params: { id: 'p1' }, query: { page: 2 },
    })
  })

  it('opens a Sharing History partner as a partner, though the package types it an institution', () => {
    const data = useExhibitionData()
    const partner = { id: 'p2', type: 'institution', backward_compatibility: 'mwnf3_sharing_history:sh_partners:lb_01' }
    expect(data.isInstitution(partner)).toBe(false)
    expect(data.partnerRoute(partner)).toEqual({ name: 'partner', params: { id: 'p2' } })
    expect(data.partnerObjectsRoute(partner)).toEqual({ name: 'partner-objects', params: { id: 'p2' }, query: {} })
  })

  it('filters out a hidden sibling site', () => {
    const data = useExhibitionData()
    expect(data.siblingSites.value.map((s) => s.id)).toEqual(['sib-1'])
  })

  it('resolves a country by its legacy two-letter code', () => {
    const data = useExhibitionData()
    expect(data.countryLabelFromCode('eg')).toBe('Egypt')
    expect(data.countryLabelFromCode('')).toBe('')
    expect(data.countryLabelFromCode('zz')).toBe('zz')
  })
})
