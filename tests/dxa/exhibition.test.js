import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useExhibitionCollection } from '../../src/dxa/exhibition/useExhibitionCollection.js'
import { useExhibitionTimeline } from '../../src/dxa/exhibition/useExhibitionTimeline.js'
import { useExhibitionPartner } from '../../src/dxa/exhibition/useExhibitionPartner.js'
import { useExhibitionSheet } from '../../src/dxa/exhibition/useExhibitionSheet.js'

// The exhibition family's spec composables, over a small hand-built `data`
// object shaped like the return value of `useExhibitionData()` — no data
// package required, so these tests read as plainly as the specs themselves.

const countries = ref([
  { id: 'c-eg', code: 'eg', internal_name: 'Egypt' },
  { id: 'c-sy', code: 'sy', internal_name: 'Syria' },
])
const countryById = computed(() => new Map(countries.value.map((c) => [c.id, c])))

const tags = ref([{ id: 't-bowl', category: 'type', legacy_tag_id: '42', label: 'Bowl' }])
const tagById = computed(() => new Map(tags.value.map((t) => [t.id, t])))

const partners = ref([{ id: 'p-1', internal_name: 'Museum One' }])
const partnerById = computed(() => new Map(partners.value.map((p) => [p.id, p])))

const items = ref([
  {
    id: 'item-1', internal_name: 'Bowl', country_id: 'c-eg', partner_id: 'p-1',
    tag_ids: ['t-bowl'], start_date: 900, end_date: 950, project_id: 'proj-a',
    owner_reference: 'INV-1', artist_names: [], images: [{ url: 'bowl.jpg' }], dynasty_ids: [],
  },
  {
    id: 'item-2', internal_name: 'Lamp (Explore)', country_id: 'c-sy', partner_id: 'p-1',
    tag_ids: [], start_date: null, end_date: null, project_id: null,
    owner_reference: 'INV-2', artist_names: [], images: [], dynasty_ids: [],
  },
])
const itemById = computed(() => new Map(items.value.map((i) => [i.id, i])))

const translationsByLang = {
  en: { 'item-1': { name: 'Glazed *bowl*', dates: '10th century', location: 'Cairo' }, 'item-2': { name: 'Lamp' } },
}

const timelines = ref([
  { id: 'tl-eg', country_id: 'c-eg', source: 'mwnf3', backward_compatibility: 'mwnf3:hcr:country:eg' },
  { id: 'tl-local', country_id: null, source: 'thg_local' },
])
const timelineEvents = ref([
  { id: 'ev-1', timeline_id: 'tl-eg', country_id: 'c-eg', year_from: 950, display_order: 0 },
  { id: 'ev-2', timeline_id: 'tl-local', country_id: null, year_from: 1400, display_order: 0 },
])

const manifest = { projects: { 'proj-a': { name: { en: 'The Use of Colours in Art' } } } }

function makeData(exhibitionOverrides = {}) {
  return {
    manifest,
    defaultLang: 'en',
    exhibition: { has_timeline: true, has_country_timeline: false, ...exhibitionOverrides },
    tr: (entity, id, lang = 'en') => translationsByLang[lang]?.[id] ?? {},
    translations: () => ({}),
    mdInline: (s) => String(s).replace(/\*/g, ''),
    mdStrip: (s) => String(s).replace(/\*/g, ''),
    labelOf: (entity, id) => {
      if (!id) return ''
      if (entity === 'countries') return countryById.value.get(id)?.internal_name ?? id
      if (entity === 'partners') return partnerById.value.get(id)?.internal_name ?? id
      return id
    },
    itemRoute: (item) => ({ name: 'item', params: { id: item.id } }),
    projectName: (item, lang = 'en') => manifest.projects[item?.project_id]?.name?.[lang] ?? null,
    isHiddenPartner: (partner) => partner?.id === 'hidden-1',
    partnerRoute: (partner) => ({ name: 'partner', params: { id: partner.id } }),
    countries,
    tags,
    countryById,
    tagById,
    partnerById,
    itemById,
    timelines,
    timelineEvents,
    items,
    labelOfCountry: countryById,
  }
}

const t = (key) => key

describe('useExhibitionCollection', () => {
  const data = makeData()
  const collection = useExhibitionCollection(data)

  it('builds a tile with the project line only when the manifest names one', () => {
    const withProject = collection.tile(items.value[0], t)
    expect(withProject.meta).toContain('catalogue.results.forProject The Use of Colours in Art')

    const explore = collection.tile(items.value[1], t)
    expect(explore.meta.some((m) => m.startsWith('catalogue.results.forProject'))).toBe(false)
  })

  it('scopes the results spec to records this build can actually render', () => {
    expect(collection.collectionResults.scope(items.value[0])).toBe(true)
    expect(collection.collectionResults.scope({ id: 'not-in-package' })).toBe(false)
  })

  it('the results summary counts against the whole renderable set, not the page', () => {
    const summary = collection.collectionResults.summary({ filters: {}, pageInfo: { total: 1 }, t })
    expect(summary[1].value).toBe('catalogue.results.outOf 2 catalogue.results.objects')
  })
})

describe('useExhibitionTimeline', () => {
  it('uses the exhibition\'s own chronology when it has a local timeline and no country flag', () => {
    const data = makeData({ has_timeline: true, has_country_timeline: false })
    const collection = useExhibitionCollection(data)
    const timeline = useExhibitionTimeline(data, collection)
    expect(timeline.usesLocalTimeline.value).toBe(true)
    expect(timeline.timelineSpec.value.scope).toBe('local')
    // No country picker on the local-chronology shape.
    expect(timeline.timelineCountries.value).toEqual([])
  })

  it('uses the worldwide country chronology when has_country_timeline is set', () => {
    const data = makeData({ has_timeline: true, has_country_timeline: true })
    const collection = useExhibitionCollection(data)
    const timeline = useExhibitionTimeline(data, collection)
    expect(timeline.usesLocalTimeline.value).toBe(false)
    expect(timeline.timelineSpec.value.scope).toBe('country')
    expect(timeline.timelineCountries.value.map((row) => row[0])).toEqual(['all', 'eg'])
  })

  it('finds the events for a country and year range, text and country name attached', () => {
    const data = makeData({ has_timeline: true, has_country_timeline: true })
    const collection = useExhibitionCollection(data)
    const timeline = useExhibitionTimeline(data, collection)
    const events = timeline.findEvents({ countryCode: 'eg', start: '', end: '' })
    expect(events).toHaveLength(1)
    expect(events[0].countryName).toBe('Egypt')
  })
})

describe('useExhibitionPartner', () => {
  const data = makeData()
  const partner = useExhibitionPartner(data)

  it('the list spec excludes a hidden partner and groups by country', () => {
    expect(partner.partnerListSpec.scope({ id: 'hidden-1' })).toBe(false)
    expect(partner.partnerListSpec.scope({ id: 'p-1' })).toBe(true)
    expect(partner.partnerListSpec.group).toEqual({ tier: false, order: 'country' })
  })

  it('the profile spec has no fields, no citation, no related', () => {
    expect(partner.partnerSheetSpec.fields).toBeUndefined()
    expect(partner.partnerSheetSpec.citation).toBe(false)
    expect(partner.partnerSheetSpec.related).toBe(false)
  })
})

describe('useExhibitionSheet', () => {
  const data = makeData()
  const sheet = useExhibitionSheet(data)

  it('the citation carries a project line, unlike the gallery shape', () => {
    expect(sheet.itemSheet.citation.project(items.value[0], { language: 'en' })).toBe('The Use of Colours in Art')
    expect(sheet.itemSheet.citation.permalink).toBe(false)
  })

  it('the related heading and action label are the exhibition\'s own entry names', () => {
    expect(sheet.itemSheet.related.heading).toBe('exhibition.related.objects')
    expect(sheet.itemSheet.related.actionLabel).toBe('exhibition.action.seeDatabaseEntry')
  })
})
