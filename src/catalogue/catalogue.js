import { useCatalogueData } from '../composables/useCatalogueData.js'
import { byId } from '../composables/useEntities.js'

// The catalogue data layer: what a website built on the generic entries —
// the standalone products, and every new product scaffolded from
// `website-template` — re-typed around `useCatalogueData` for itself, three
// times (inventory-app#2037): the entity refs and lookups a catalogue reads,
// the label and route helpers, the one result row every list shows, the
// "[N objects, M monuments]" count. A site keeps one instance of it, in its
// `data.js`, next to what is genuinely its own (a scope rule, a collection
// tree, its legacy address mappings).
//
// The DXA families have their own layer (`@museumwnf/viewer-core/dxa`), over
// the same `useCatalogueData`; nothing here reads it.

/** Twenty rows a page: the legacy standalone pages' own size. */
export const CATALOGUE_PAGE_SIZE = 20

/**
 * The standalone date rule (decision D5): a record overlapping the window
 * counts, a record with one date is tolerated. The DXA families contain
 * (`@museumwnf/viewer-core/dxa`'s `DATE_MODE`); a site names its rule once.
 */
export const CATALOGUE_DATE_MODE = 'overlap'

/**
 * The website's catalogue: everything `useCatalogueData` returns, plus the
 * catalogue entities, their lookups, the labels, the routes and the result
 * row. Takes `useCatalogueData`'s own options (`eager`, `defaultLanguage`,
 * `visible`, `glossary`); called once, at the top of the site's `data.js`.
 *
 * - `items`, `countries`, `partners`, `dynasties`: the visible records
 *   (`visible` applies), `null` until loaded.
 * - `itemById`: every item, the visible rule not applied — a page that
 *   deliberately shows a hidden item (a timeline's illustration) reads it.
 *   `partnerById`, `countryById`, `dynastyById`: the visible records.
 * - `itemLabel(item)`, `countryLabel(id)`, `partnerLabel(id)`,
 *   `dynastyLabel(id)`: plain text, `''` for nothing.
 * - `itemRoute(item)`, `partnerRoute(partner)`: the `item` and `partner`
 *   routes by name.
 * - `itemRow(item, meta)`: the row `RecordList`/`RecordGrid`/
 *   `RelatedRecords` share. `meta` lists what follows the name, in order:
 *   `'country'`, `'dates'`, `'location'`, `'dynasties'`, `'holder'` (the
 *   partner's name, only when the package carries the partner, so a label
 *   is never an id), or a function `(item, text) => string`.
 */
export function useCatalogue(options = {}) {
  const data = useCatalogueData(options)
  const { tr, labelOf, mdInline } = data

  const items = data.entity('items')
  const countries = data.entity('countries')
  const partners = data.entity('partners')
  const dynasties = data.entity('dynasties')

  const itemById = byId('items')
  const partnerById = data.index('partners')
  const countryById = data.index('countries')
  const dynastyById = data.index('dynasties')

  const itemLabel = (item) => (item ? labelOf('items', item.id) : '')
  const countryLabel = (id) => (id ? labelOf('countries', id) : '')
  const partnerLabel = (id) => (id ? labelOf('partners', id) : '')
  const dynastyLabel = (id) => (id ? labelOf('dynasties', id) : '')

  const itemRoute = (item) => ({ name: 'item', params: { id: item.id } })
  const partnerRoute = (partner) => ({ name: 'partner', params: { id: partner.id } })

  const META = {
    country: (item) => countryLabel(item.country_id),
    dates: (item, text) => text.dates,
    location: (item, text) => text.location,
    dynasties: (item) => (item.dynasty_ids ?? []).map(dynastyLabel).filter(Boolean).join(', '),
    holder: (item) => (partnerById.value.has(item.partner_id) ? partnerLabel(item.partner_id) : ''),
  }

  function itemRow(item, meta = ['country', 'dates']) {
    const text = tr('items', item.id)
    return {
      id: item.id,
      image: item.images?.[0]?.url ?? '',
      imageAlt: itemLabel(item),
      name: mdInline(text.name ?? item.internal_name ?? item.id),
      meta: meta
        .map((part) => (typeof part === 'function' ? part(item, text) : META[part]?.(item, text)))
        .filter(Boolean),
      badge: item.type ?? '',
      to: itemRoute(item),
    }
  }

  return {
    ...data,
    items,
    countries,
    partners,
    dynasties,
    itemById,
    partnerById,
    countryById,
    dynastyById,
    itemLabel,
    countryLabel,
    partnerLabel,
    dynastyLabel,
    itemRoute,
    partnerRoute,
    itemRow,
  }
}

/**
 * Legacy's count, "[N objects, M monuments]", over what matched: a results
 * spec's `summary`. A monument is a record of type `monument`; everything
 * else counts as an object.
 */
export function objectsAndMonumentsSummary({ matching, t }) {
  let objects = 0
  let monuments = 0
  for (const item of matching ?? []) {
    if (item.type === 'monument') monuments++
    else objects++
  }
  return [
    { label: t('catalogue.results.objectsFound'), count: objects },
    { label: t('catalogue.results.monumentsFound'), count: monuments },
  ]
}
