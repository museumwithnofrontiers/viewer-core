import { computed, ref } from 'vue'
import { useI18n } from '../i18n/index.js'
import { combineExpansions, countryExpansion, glossaryExpansion, useKeywordIndex } from './keywordIndex.js'

// The field search of the legacy `database.php` form — keyword rows, each
// naming a field, folded with AND/OR — which the three standalone products
// each wired for themselves (inventory-app#2037): the fields' haystacks, the
// field options and their labels, the rows the query string carries, the
// "searched for" line, the index. `useKeywordIndex`'s `fields` grammar is
// the engine; this is the rest of the machinery around it, written once.

/**
 * What each field of the form searches, field for field as legacy's form
 * did. `text` is the record's translation in the search language, English
 * behind it. `keyword` and `location` also carry the record's `country_id`:
 * `countryExpansion` turns a typed country name into its id, and a field is
 * only found by that expansion if its haystack carries the id.
 *
 * `dynastyLabel(id)` turns on the `dynasty` field — Islamic Art's form has
 * it, Baroque Art's and Sharing History's do not.
 */
export function searchFields({ dynastyLabel } = {}) {
  const fields = {
    keyword: (item, text) => [
      text.name ?? item.internal_name, text.alternate_name, text.description, item.country_id, ...(item.tags ?? []),
    ],
    name: (item, text) => text.name ?? item.internal_name,
    location: (item, text) => [text.location, item.country_id],
    provenance: (item, text) => text.provenance,
    patron: (item, text) => text.patrons ?? text.initial_owner,
    artist: (item, text) => [...(item.artist_names ?? []), text.architects],
    material: (item, text) => text.type,
    // The catch-all across the descriptive fields the others leave out.
    other: (item, text) => [
      text.description, text.method_for_datation, text.method_for_provenance, text.obtention,
      text.bibliography, text.workshop, text.scriber, text.binding_desc, text.history,
    ],
  }
  if (dynastyLabel) fields.dynasty = (item) => (item.dynasty_ids ?? []).map(dynastyLabel)
  return fields
}

// Every field of the form, in legacy's order, with its entry name.
const FIELD_OPTIONS = [
  { key: 'keyword', label: 'catalogue.field.keywords' },
  { key: 'name', label: 'sheet.field.name' },
  { key: 'location', label: 'sheet.field.location' },
  { key: 'provenance', label: 'sheet.field.provenance' },
  { key: 'dynasty', label: 'catalogue.facet.periodDynasty' },
  { key: 'patron', label: 'catalogue.field.patron' },
  { key: 'artist', label: 'catalogue.field.artist' },
  { key: 'material', label: 'catalogue.field.material' },
  { key: 'other', label: 'catalogue.field.other' },
]

/**
 * The options of the form's field select — `[{ key, label }]`, `label` an
 * entry name, in legacy's order — for the fields `fields` carries: what
 * `SearchFormView`'s `fields` takes.
 */
export function searchFieldOptions(fields) {
  return FIELD_OPTIONS.filter((option) => option.key in fields)
}

/** One field's label, resolved: `key` is what the query string carries. */
export function searchFieldLabel(key, t) {
  switch (key) {
    case 'keyword': return t('catalogue.field.keywords')
    case 'name': return t('sheet.field.name')
    case 'location': return t('sheet.field.location')
    case 'provenance': return t('sheet.field.provenance')
    case 'dynasty': return t('catalogue.facet.periodDynasty')
    case 'patron': return t('catalogue.field.patron')
    case 'artist': return t('catalogue.field.artist')
    case 'material': return t('catalogue.field.material')
    case 'other': return t('catalogue.field.other')
    default: return key
  }
}

/**
 * The same options resolved, `[{ value, label }]`, for a select a site draws
 * itself — the results page's refine row.
 */
export function useSearchFieldOptions(fields) {
  const { t } = useI18n()
  return computed(() => searchFieldOptions(fields).map((option) => ({ value: option.key, label: searchFieldLabel(option.key, t) })))
}

/**
 * The keyword rows the query string carries: `q`/`field` for the first
 * (`SearchFormView`'s own, unnumbered), `qN`/`fieldN`/`opN` for the next —
 * three from the entrance, a fourth for the results page's refine row.
 * A row with no field searches `keyword`; with no operator, AND.
 */
export function searchRows(filters, count = 4) {
  const rows = []
  for (let n = 1; n <= count; n++) {
    rows.push({
      keyword: n === 1 ? filters.q : filters[`q${n}`],
      field: (n === 1 ? filters.field : filters[`field${n}`]) || 'keyword',
      cond: n === 1 ? 'AND' : filters[`op${n}`] || 'AND',
    })
  }
  return rows
}

/** The query keys `searchRows` reads, for a results spec's `keys`. */
export function searchRowKeys(count = 4) {
  const keys = ['q', 'field']
  for (let n = 2; n <= count; n++) keys.push(`q${n}`, `field${n}`, `op${n}`)
  return keys
}

/**
 * What was searched, spelled out: `Name: "bowl"`, `AND Location: "Cairo"`,
 * the years, the search language, then the site's own `extras` —
 * `(filters, t) => string` each, an empty string for nothing. Legacy's
 * recap line, never just a count, so a visitor who scrolls past the form
 * still reads what for.
 */
export function searchedFor(filters, t, { rows = 4, extras = [] } = {}) {
  const parts = searchRows(filters, rows)
    .filter((row) => row.keyword)
    .map((row, i) => `${i > 0 ? `${row.cond} ` : ''}${searchFieldLabel(row.field, t)}: "${row.keyword}"`)
  if (filters.from) parts.push(`${t('catalogue.filter.from')} ${filters.from}`)
  if (filters.to) parts.push(`${t('catalogue.filter.to')} ${filters.to}`)
  if (filters.lang) parts.push(`${t('catalogue.search.language')}: ${String(filters.lang).toUpperCase()}`)
  for (const extra of extras) {
    const part = extra(filters, t)
    if (part) parts.push(part)
  }
  return parts
}

/**
 * The results page's summary: what was searched (`searchedFor`), or "all
 * items" for an empty query, then the count. `options` is `searchedFor`'s.
 */
export function searchSummary({ filters, t, pageInfo }, options = {}) {
  const parts = searchedFor(filters, t, options)
  return [
    { label: t('catalogue.search.summary'), value: parts.length ? parts.join(' · ') : t('catalogue.results.allItems') },
    { label: t('catalogue.results.itemsFound'), count: pageInfo.total },
  ]
}

/**
 * The index behind the results page: one long-lived `useKeywordIndex` over
 * `entity` (`fields` grammar, legacy's `rank: 'hits'` order, the glossary
 * and country expansions of `database_results.php`), its search language
 * kept in step with the query's `lang`. `narrow(list, filters)` is a results
 * spec's `narrow`: the matches in rank order, kept to what `list` (the
 * records the spec's `scope` let through) carries. Pass `sort: false` to the
 * spec, so the rank order stands.
 */
export function useFieldSearch({
  fields,
  entity = 'items',
  rows = 4,
  rank = 'hits',
  expand = combineExpansions(glossaryExpansion(), countryExpansion()),
} = {}) {
  const language = ref('')
  const index = useKeywordIndex(entity, { grammar: 'fields', fields, language, rank, expand })

  function narrow(list, filters) {
    language.value = filters.lang || ''
    const matches = index.search(searchRows(filters, rows))
    if (!list) return matches
    const allowed = new Set(list.map((record) => record.id))
    return matches.filter((record) => allowed.has(record.id))
  }

  return { narrow, index }
}
