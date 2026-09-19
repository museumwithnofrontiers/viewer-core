import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useGalleryCollection } from '../../src/dxa/gallery/useGalleryCollection.js'
import { useGalleryTimeline } from '../../src/dxa/gallery/useGalleryTimeline.js'
import { useGalleryPartner } from '../../src/dxa/gallery/useGalleryPartner.js'
import { useGallerySheet } from '../../src/dxa/gallery/useGallerySheet.js'

// The gallery family's spec composables, over a small hand-built `data`
// object shaped like the return value of `useGalleryData()` — no data
// package required, so these tests read as plainly as the specs themselves.

const countries = ref([
  { id: 'c-eg', code: 'eg', internal_name: 'Egypt' },
  { id: 'c-sy', code: 'sy', internal_name: 'Syria' },
])
const countryById = computed(() => new Map(countries.value.map((c) => [c.id, c])))

const tags = ref([
  { id: 't-bowl', category: 'type', legacy_tag_id: '42', label: 'Bowl' },
  { id: 't-ceramic', category: 'material', legacy_tag_id: '7', label: 'Ceramic' },
])
const tagById = computed(() => new Map(tags.value.map((t) => [t.id, t])))

const partners = ref([{ id: 'p-1', internal_name: 'Museum One' }])
const partnerById = computed(() => new Map(partners.value.map((p) => [p.id, p])))

const dynasties = ref([{ id: 'dyn-1', internal_name: 'Fatimid' }])

const items = ref([
  {
    id: 'item-1', internal_name: 'Bowl', country_id: 'c-eg', partner_id: 'p-1',
    tag_ids: ['t-bowl', 't-ceramic'], start_date: 900, end_date: 950, project_id: 'proj-a',
    owner_reference: 'INV-1', artist_names: ['A. Potter'], images: [{ url: 'bowl.jpg' }],
    dynasty_ids: ['dyn-1'],
  },
  {
    id: 'item-2', internal_name: 'Lamp', country_id: 'c-sy', partner_id: 'p-1',
    tag_ids: [], start_date: null, end_date: null, project_id: null,
    owner_reference: 'INV-2', artist_names: [], images: [], dynasty_ids: [],
  },
])

const translationsByLang = {
  en: { 'item-1': { name: 'Glazed *bowl*', dates: '10th century', location: 'Cairo' }, 'item-2': { name: 'Lamp' } },
}
const dynastyTranslations = { en: { 'dyn-1': { name: 'Fatimid dynasty' } } }

const timelines = ref([{ id: 'tl-eg', country_id: 'c-eg', backward_compatibility: 'mwnf3:hcr:country:eg' }])

const manifest = { projects: { 'proj-a': { name: { en: 'Discover Carpet Art' } } } }

function makeData() {
  return {
    manifest,
    defaultLang: 'en',
    tr: (entity, id, lang = 'en') => translationsByLang[lang]?.[id] ?? {},
    translations: (entity, lang) => (entity === 'dynasties' ? (dynastyTranslations[lang] ?? {}) : {}),
    mdInline: (s) => String(s).replace(/\*/g, ''),
    mdStrip: (s) => String(s).replace(/\*/g, ''),
    labelOf: (entity, id) => {
      if (!id) return ''
      if (entity === 'countries') return countryById.value.get(id)?.internal_name ?? id
      if (entity === 'partners') return partnerById.value.get(id)?.internal_name ?? id
      if (entity === 'items') return translationsByLang.en[id]?.name?.replace(/\*/g, '') ?? id
      return id
    },
    itemRoute: (item) => ({ name: 'item', params: { id: item.id } }),
    countries,
    tags,
    countryById,
    tagById,
    partnerById,
    timelines,
    items,
    loadTranslations: () => {},
  }
}

const t = (key) => key

describe('useGalleryCollection', () => {
  const data = makeData()
  const collection = useGalleryCollection(data)

  it('builds a tile with the source-project line from the manifest', () => {
    const tile = collection.tile(items.value[0], t)
    expect(tile.id).toBe('item-1')
    expect(tile.name).toBe('Glazed bowl')
    expect(tile.meta).toContain('catalogue.results.forProject Discover Carpet Art')
    expect(tile.to).toEqual({ name: 'item', params: { id: 'item-1' } })
  })

  it('still prints the project line, empty, for a record with no project — unlike the exhibition shape', () => {
    const tile = collection.tile(items.value[1], t)
    expect(tile.meta).toContain('catalogue.results.forProject ')
  })

  it('resolves a country facet value by its legacy two-letter code', () => {
    expect(collection.countryIdForCode('eg')).toBe('c-eg')
    expect(collection.countryIdForCode('zz')).toBeNull()
  })

  it('resolves a tag facet value by its legacy numeric id', () => {
    expect(collection.tagIdForLegacy('42')).toBe('t-bowl')
    expect(collection.tagLabelForLegacy('42')).toBe('Bowl')
    expect(collection.tagLabelForLegacy('nope')).toBe('nope')
  })

  it('reads the country facet off an item through its inventory country id', () => {
    expect(collection.FACETS.country.values(items.value[0])).toBe('eg')
    expect(collection.FACETS.country.label('eg')).toBe('Egypt')
  })

  it('the results spec declares the containment date rule and nine-a-page paging', () => {
    expect(collection.collectionResults.dates).toEqual({ mode: 'contain', begin: 'from', end: 'to' })
    expect(collection.collectionResults.pageSize).toBe(9)
  })
})

describe('useGalleryTimeline', () => {
  const data = makeData()
  const collection = useGalleryCollection(data)
  const timeline = useGalleryTimeline(data, collection)

  it('resolves a country id from its legacy chronology code', () => {
    expect(timeline.countryIdForCode('eg')).toBe('c-eg')
    expect(timeline.countryIdForCode('all')).toBeNull()
  })

  it('names a country the chronology carries', () => {
    expect(timeline.countryLabel('c-eg')).toBe('Egypt')
  })

  it('counts the member items overlapping a period', () => {
    expect(timeline.timelineGalleryItems({ country: 'eg', begin: '850', end: '1000' }).length).toBe(1)
    expect(timeline.timelineGalleryItems({}).length).toBe(1) // only item-1 is dated
  })

  it('the results spec carries the country/period controls and the gallery cross-link', () => {
    expect(timeline.timelineResults.route).toBe('timeline-results')
    expect(timeline.timelineResults.controls.map((c) => c.key)).toEqual(['country', 'begin', 'end'])
    expect(timeline.timelineResults.gallery.route).toBe('timeline-gallery')
  })

  it('the gallery-page spec scopes on the same country/period join, nine a page', () => {
    expect(timeline.timelineGallery.pageSize).toBe(9)
    expect(timeline.timelineGallery.scope(items.value[0], { country: 'eg' })).toBe(true)
    expect(timeline.timelineGallery.scope(items.value[1], { country: 'eg' })).toBe(false)
  })
})

describe('useGalleryPartner', () => {
  const data = makeData()
  const collection = useGalleryCollection(data)
  const partner = useGalleryPartner(data, collection)

  it('the list spec groups by country with no tiers, A-Z toggle on', () => {
    expect(partner.partnerList.group).toEqual({ tier: false, order: 'country' })
    expect(partner.partnerList.orderToggle).toBe(true)
    expect(partner.partnerList.label('c-eg')).toBe('Egypt')
  })

  it('the profile spec carries no fields and no citation/related sections', () => {
    expect(partner.partnerSheet.fields).toEqual([])
    expect(partner.partnerSheet.citation).toBe(false)
    expect(partner.partnerSheet.related).toBe(false)
  })

  it('the objects-page spec reuses the collection tile, nine a page', () => {
    expect(partner.partnerObjects.pageSize).toBe(9)
    expect(partner.partnerObjects.record(items.value[0], { t }).id).toBe('item-1')
  })
})

describe('useGallerySheet', () => {
  const data = makeData()
  const sheet = useGallerySheet(data)

  it('declares the legacy field order, with the holding museum as a custom row', () => {
    const keys = sheet.itemSheet.fields.map((f) => f.key)
    expect(keys[0]).toBe('name')
    expect(keys).toContain('museum')
    const museumField = sheet.itemSheet.fields.find((f) => f.key === 'museum')
    expect(museumField.render).toBe('custom')
  })

  it('resolves the dynasty names field from the translated dynasty list', () => {
    const dynastyField = sheet.itemSheet.fields.find((f) => f.key === 'dynasty')
    const ctx = { record: items.value[0], language: 'en' }
    expect(dynastyField.value(ctx)).toBe('Fatimid dynasty')
  })

  it('citation has no permalink and no per-project line, unlike the exhibition shape', () => {
    expect(sheet.itemSheet.citation).toEqual({ permalink: false, heading: 'record.citation.ofThisPage' })
    expect(sheet.itemSheet.citation.project).toBeUndefined()
  })

  it('the related tile carries the country and a stripped justification', () => {
    const tile = sheet.itemSheet.related.record({ record: items.value[1], justification: '*Same workshop*' })
    expect(tile.meta).toEqual(['Syria', 'Same workshop'])
  })
})
