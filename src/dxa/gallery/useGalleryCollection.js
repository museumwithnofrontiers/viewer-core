import { projectLabel } from '../../conventions.js'
import { DATE_MODE, FACET_CATEGORIES, PAGE_SIZE } from '../shared.js'

export { DATE_MODE, FACET_CATEGORIES, FACET_LABEL_KEYS, PAGE_SIZE, useFacetLabels } from '../shared.js'

// The catalogue spec: what a DXA gallery's lists filter and search on. The
// engine — query state, options, dates, pages, the boolean grammar — is
// viewer-core's own (`useFacets`, `useListQuery`, …); what is declared here
// is only what is a gallery's: the facet *predicates* over its own data,
// the haystack the search bar reads, and the tile a record becomes.
// `PAGE_SIZE`/`DATE_MODE`/`FACET_CATEGORIES`/`FACET_LABEL_KEYS`/
// `useFacetLabels` are shared verbatim with the exhibition family — see
// `../shared.js`.
//
// Legacy asked the API for everything: `/items?ic[]=…&id[]=…&na=…&nz=…` for
// the results, and `/items/countries`, `/items/tags`, `/items/years` *with
// the same filters applied* for the dropdowns — which is what made the
// facets dependent (pick a country, and the type list shrinks to the types
// still reachable). The results page hands the engine the matching subset
// for that reason; the entrance hands it everything.

/**
 * The gallery's collection spec, over its own data layer's `data` (the
 * return value of {@link import('./useGalleryData.js').useGalleryData}).
 *
 * Reads `data.tags`, `data.countryById`, `data.tagById`, `data.labelOf`,
 * `data.itemRoute`, `data.tr`, `data.defaultLang`, `data.mdInline`,
 * `data.manifest` and `data.countryIdForCode`. `config` carries nothing
 * today.
 */
export function useGalleryCollection(data, config = {}) {
  void config
  const { tags, countryById, tagById, labelOf, itemRoute, tr, defaultLang, mdInline, manifest, countryIdForCode } = data

  // ── What the URL carries ─────────────────────────────────────────────
  //
  // The legacy 2-letter country code for `country` (the data layer's
  // `countryIdForCode`), the legacy tag id for a facet: the values legacy's
  // URLs carried, so a link shared then still resolves now.

  function tagIdForLegacy(legacyId) {
    return legacyId ? (tags.value ?? []).find((t) => t.legacy_tag_id === legacyId)?.id ?? null : null
  }

  function tagLabelForLegacy(legacyId) {
    return (tags.value ?? []).find((t) => t.legacy_tag_id === legacyId)?.label ?? legacyId
  }

  /**
   * The facet spec for viewer-core's `useFacets`: the country by code, each
   * tag category by legacy id, labels upper-cased on the first letter as
   * legacy printed them.
   */
  const FACETS = {
    country: {
      values: (item) => countryById.value.get(item.country_id)?.code ?? null,
      label: (code) => labelOf('countries', countryIdForCode(code)),
    },
    ...Object.fromEntries(
      FACET_CATEGORIES.map((category) => [
        category,
        {
          values: (item) =>
            (item.tag_ids ?? [])
              .map((id) => tagById.value.get(id))
              .filter((tag) => tag && tag.category === category)
              .map((tag) => tag.legacy_tag_id),
          label: tagLabelForLegacy,
          capitalize: true,
        },
      ]),
    ),
  }

  /** The legacy `/items` predicate's tag half: every requested tag, ANDed. */
  function hasEveryTag(item, tagIds) {
    return tagIds.every((id) => item.tag_ids?.includes(id))
  }

  // ── The search bar ───────────────────────────────────────────────────
  //
  // Legacy ran MySQL boolean full-text search over the English sheet; the
  // haystack is the same set of fields, and the grammar is viewer-core's.

  function haystack(item, text) {
    return [
      text.name, text.description, text.short_description, text.type, text.holder, text.dates,
      text.location, text.provenance, text.alternate_name, text.place_of_production,
      ...(text.keywords ?? []), ...(text.materials ?? []),
      item.internal_name, item.owner_reference, item.mwnf_reference,
      labelOf('partners', item.partner_id), labelOf('countries', item.country_id),
    ]
  }

  // ── The tile ──────────────────────────────────────────────────────────

  /**
   * A record as viewer-layout's grid contract: the thumbnail, the name, the
   * lines legacy's hover card carried (date, holder, place, source
   * project).
   */
  function tile(item, t) {
    const text = tr('items', item.id, defaultLang)
    return {
      id: item.id,
      image: item.images?.[0]?.url ?? '',
      imageAlt: labelOf('items', item.id),
      name: mdInline(text.name ?? item.internal_name ?? ''),
      meta: [
        text.dates ?? '',
        labelOf('partners', item.partner_id),
        [text.location, labelOf('countries', item.country_id)].filter(Boolean).join(', '),
        `${t('catalogue.results.forProject')} ${projectLabel(manifest, item.project_id, defaultLang) ?? ''}`,
      ].filter(Boolean),
      to: itemRoute(item),
    }
  }

  // ── The results page, as a spec ──────────────────────────────────────
  //
  // What viewer-layout's `CatalogueResultsView` renders on
  // `/collection-results`: the facets over the *matching* records (the
  // dependent dropdowns above), the containment date rule, undated first,
  // nine tiles a page, legacy's "Collection | <selections>" summary line.
  // The panel itself is composed by the view's wrapper, in the aside where
  // legacy put it, so no controls are declared here. Every text is an entry
  // name.

  // `from`/`to`, not `start`/`end`: the entrance's `SearchFormView` spec
  // (`mode: 'facets'`, `dates: 'buckets'`) writes the date bounds under
  // those two fixed keys — the view's own, not something a spec can rename
  // — so the results side has to read the same ones to stay linked to it.
  const KEYS = ['country', ...FACET_CATEGORIES, 'from', 'to']

  /** The filter summary line legacy printed as "Collection | <selections>". */
  function filterSummary(filters, t) {
    const parts = []
    if (filters.country) parts.push(labelOf('countries', countryIdForCode(filters.country)))
    for (const key of FACET_CATEGORIES) if (filters[key]) parts.push(tagLabelForLegacy(filters[key]))
    if (filters.from) parts.push(`${t('catalogue.filter.from')} ${filters.from}`)
    if (filters.to) parts.push(`${t('catalogue.filter.to')} ${filters.to}`)
    return parts.filter(Boolean).join(' | ')
  }

  const collectionResults = {
    entity: 'items',
    keys: KEYS,
    facets: FACETS,
    facetScope: 'matching',
    filterMode: 'immediate',
    dates: { mode: DATE_MODE, begin: 'from', end: 'to' },
    sort: { undated: 'first' },
    pageSize: PAGE_SIZE,
    variant: 'grid',
    recordRoute: 'item',
    actionLabel: 'catalogue.results.seeDatabaseEntry',
    empty: 'catalogue.results.noResults',
    pagination: { jump: true },

    record: (item, { t }) => tile(item, t),

    summary: ({ filters, pageInfo, t, total }) => [
      { label: t('core.section.collection'), value: filterSummary(filters, t) },
      { count: pageInfo.total, value: `${t('catalogue.results.outOf')} ${total} ${t('catalogue.results.objects')}` },
    ],
  }

  return {
    FACETS, hasEveryTag, haystack, tile, collectionResults,
    countryIdForCode, tagIdForLegacy, tagLabelForLegacy,
  }
}
