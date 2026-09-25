import { beforeAll, describe, expect, it } from 'vitest'
import {
  CATALOGUE_DATE_MODE, CATALOGUE_PAGE_SIZE, loadEntities, objectsAndMonumentsSummary, searchFieldLabel, searchFieldOptions,
  searchFields, searchRowKeys, searchRows, searchSummary, searchedFor, useCatalogue, useFieldSearch,
} from '../src/index.js'

// The catalogue data layer (inventory-app#2037), over the shared fixture
// package: items, countries, partners and dynasties, English translations.
beforeAll(async () => {
  await loadEntities(['items', 'countries', 'partners', 'dynasties', 'glossary'])
})

const t = (key) => ({
  'catalogue.field.keywords': 'Keywords',
  'sheet.field.name': 'Name',
  'sheet.field.location': 'Location',
  'catalogue.facet.periodDynasty': 'Period / Dynasty',
  'catalogue.filter.from': 'From',
  'catalogue.filter.to': 'To',
  'catalogue.search.language': 'Language',
  'catalogue.search.summary': 'You searched for',
  'catalogue.results.allItems': 'all items',
  'catalogue.results.itemsFound': 'Items found',
  'catalogue.results.objectsFound': 'objects',
  'catalogue.results.monumentsFound': 'monuments',
})[key] ?? key

describe('useCatalogue', () => {
  it('names the standalone page size and date rule apart from the DXA ones', () => {
    expect(CATALOGUE_PAGE_SIZE).toBe(20)
    expect(CATALOGUE_DATE_MODE).toBe('overlap')
  })

  it('reads the catalogue entities, their lookups and labels', async () => {
    const catalogue = useCatalogue({ eager: ['items', 'countries', 'dynasties'] })
    await catalogue.loadEnglish()
    expect(catalogue.items.value.map((i) => i.id)).toEqual(['item-1', 'item-2', 'item-3'])
    expect(catalogue.countryById.value.get('c-eg').code).toBe('eg')
    expect(catalogue.itemLabel(catalogue.itemById.value.get('item-1'))).toBe('Glazed bowl')
    expect(catalogue.countryLabel('c-sy')).toBe('Syria')
    expect(catalogue.dynastyLabel('dyn-1')).toBe('Fatimid dynasty')
    expect(catalogue.countryLabel(null)).toBe('')
    expect(catalogue.itemRoute({ id: 'item-1' })).toEqual({ name: 'item', params: { id: 'item-1' } })
    expect(catalogue.partnerRoute({ id: 'p' })).toEqual({ name: 'partner', params: { id: 'p' } })
  })

  it('applies the visible rule to the entity, not to itemById', async () => {
    const catalogue = useCatalogue({ eager: ['items'], visible: { items: (item) => item.id !== 'item-2' } })
    await catalogue.loadEnglish()
    expect(catalogue.items.value.map((i) => i.id)).toEqual(['item-1', 'item-3'])
    expect(catalogue.itemById.value.has('item-2')).toBe(true)
  })

  it('builds the one result row, its meta in the order asked for', async () => {
    const { itemRow, loadEnglish, itemById } = useCatalogue({ eager: ['items', 'countries', 'dynasties'] })
    await loadEnglish()
    const bowl = itemById.value.get('item-1')
    expect(itemRow(bowl)).toEqual({
      id: 'item-1',
      image: 'bowl.jpg',
      imageAlt: 'Glazed bowl',
      name: 'Glazed <em>bowl</em>',
      meta: ['Egypt', '10th century'],
      badge: '',
      to: { name: 'item', params: { id: 'item-1' } },
    })
    expect(itemRow(bowl, ['country', 'dates', 'location']).meta).toEqual(['Egypt', '10th century', 'Cairo'])
    expect(itemRow(bowl, ['dynasties', (item) => item.owner_reference]).meta).toEqual(['Fatimid dynasty', 'INV-1'])
    // The holder shows only for a partner the package carries.
    expect(itemRow(bowl, ['holder']).meta).toEqual(['partner-fr-owner'])
    expect(itemRow({ ...bowl, partner_id: 'not-in-package' }, ['holder']).meta).toEqual([])
    // An empty value is dropped, not printed.
    expect(itemRow(itemById.value.get('item-2'), ['country', 'dates']).meta).toEqual(['Syria'])
  })
})

describe('objectsAndMonumentsSummary', () => {
  it('counts monuments apart from everything else', () => {
    const matching = [{ type: 'object' }, { type: 'monument' }, { type: 'detail' }]
    expect(objectsAndMonumentsSummary({ matching, t })).toEqual([
      { label: 'objects', count: 2 },
      { label: 'monuments', count: 1 },
    ])
  })
})

describe('the field search', () => {
  it('has the dynasty field only when a label is given', () => {
    expect(Object.keys(searchFields())).not.toContain('dynasty')
    expect(Object.keys(searchFields({ dynastyLabel: (id) => id }))).toContain('dynasty')
  })

  it('offers the fields a site searches, in legacy order', () => {
    expect(searchFieldOptions(searchFields()).map((o) => o.key)).toEqual(['keyword', 'name', 'location', 'provenance', 'patron', 'artist', 'material', 'other'])
    const withDynasty = searchFieldOptions(searchFields({ dynastyLabel: (id) => id }))
    expect(withDynasty.map((o) => o.key)).toEqual(['keyword', 'name', 'location', 'provenance', 'dynasty', 'patron', 'artist', 'material', 'other'])
    expect(withDynasty[4]).toEqual({ key: 'dynasty', label: 'catalogue.facet.periodDynasty' })
    expect(searchFieldLabel('location', t)).toBe('Location')
    expect(searchFieldLabel('unknown', t)).toBe('unknown')
  })

  it('reads the keyword rows the query string carries', () => {
    expect(searchRows({ q: 'bowl', q2: 'Cairo', field2: 'location', op2: 'OR' })).toEqual([
      { keyword: 'bowl', field: 'keyword', cond: 'AND' },
      { keyword: 'Cairo', field: 'location', cond: 'OR' },
      { keyword: undefined, field: 'keyword', cond: 'AND' },
      { keyword: undefined, field: 'keyword', cond: 'AND' },
    ])
    expect(searchRows({}, 2)).toHaveLength(2)
    expect(searchRowKeys()).toEqual(['q', 'field', 'q2', 'field2', 'op2', 'q3', 'field3', 'op3', 'q4', 'field4', 'op4'])
  })

  it('spells out what was searched, with a site’s own extras last', () => {
    const filters = { q: 'bowl', field: 'name', q2: 'Cairo', field2: 'location', op2: 'OR', from: '900', lang: 'fr', epm: '1' }
    const extras = [(f) => (f.epm === '1' ? '+ Explore' : '')]
    expect(searchedFor(filters, t, { extras })).toEqual(['Name: "bowl"', 'OR Location: "Cairo"', 'From 900', 'Language: FR', '+ Explore'])
    expect(searchSummary({ filters: {}, t, pageInfo: { total: 3 } })).toEqual([
      { label: 'You searched for', value: 'all items' },
      { label: 'Items found', count: 3 },
    ])
  })

  it('narrows to the matches in rank order, kept to the scoped list', async () => {
    const catalogue = useCatalogue({ eager: ['items', 'countries', 'glossary'] })
    await catalogue.loadEnglish()
    const { narrow } = useFieldSearch({ fields: searchFields() })
    expect(narrow(null, { q: 'lamp' }).map((i) => i.id)).toEqual(['item-2'])
    // A country's name matches every item held there (the country expansion).
    expect(narrow(null, { q: 'Egypt', field: 'location' }).map((i) => i.id)).toEqual(['item-1'])
    // What the spec's scope left out stays out.
    const scoped = catalogue.items.value.filter((i) => i.id !== 'item-2')
    expect(narrow(scoped, { q: 'lamp' })).toEqual([])
  })
})
