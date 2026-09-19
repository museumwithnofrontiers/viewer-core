import { DATE_MODE, FACET_CATEGORIES, PAGE_SIZE } from '../shared.js'

export { DATE_MODE, FACET_CATEGORIES, FACET_LABEL_KEYS, PAGE_SIZE, useFacetLabels } from '../shared.js'

// The catalogue spec: what a DXA exhibition's lists filter and search on.
// The engine — query state, options, dates, pages, the boolean grammar — is
// viewer-core's own; what is declared here is only what is an exhibition's:
// the facet *predicates* over its own data, the haystack the search bar
// reads, and the tile a record becomes.
// `PAGE_SIZE`/`DATE_MODE`/`FACET_CATEGORIES`/`FACET_LABEL_KEYS`/
// `useFacetLabels` are shared verbatim with the gallery family — see
// `../shared.js`.
//
// Legacy asked the API for everything: `/items?ic[]=…&id[]=…&na=…&nz=…` for
// the results, and `/items/countries`, `/items/tags`, `/items/years` *with
// the same filters applied* for the dropdowns — which is what made the
// facets dependent (pick a country, and the type list shrinks to the types
// still reachable). The results page hands the engine the matching subset
// for that reason; the entrance hands it everything.

/**
 * The exhibition's collection spec, over its own data layer's `data` (the
 * return value of {@link import('./useExhibitionData.js').useExhibitionData}).
 *
 * Reads `data.countries`, `data.tags`, `data.countryById`, `data.tagById`,
 * `data.itemById`, `data.labelOf`, `data.itemRoute`, `data.tr`,
 * `data.defaultLang`, `data.mdInline`, `data.projectName`. `config` carries
 * nothing today.
 */
export function useExhibitionCollection(data, config = {}) {
  void config
  const {
    countries, tags, countryById, tagById, itemById, labelOf, itemRoute, tr, defaultLang, mdInline, projectName,
  } = data

  // ── What the URL carries ─────────────────────────────────────────────
  //
  // The legacy 2-letter country code for `country`, the legacy tag id for a
  // facet: the values legacy's URLs carried, so a link shared then still
  // resolves now.

  function countryIdForCode(code) {
    return code ? (countries.value ?? []).find((c) => c.code === code)?.id ?? null : null
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
   * project). The project name is the manifest's own, read in the same
   * `defaultLang` every other line of this tile is — nothing for a record
   * legacy left nameless (the Explore case), so the line is dropped, not
   * printed with a hole in it.
   */
  function tile(item, t) {
    const text = tr('items', item.id, defaultLang)
    const project = projectName(item, defaultLang)
    return {
      id: item.id,
      image: item.images?.[0]?.url ?? '',
      imageAlt: labelOf('items', item.id),
      name: mdInline(text.name ?? item.internal_name ?? ''),
      meta: [
        text.dates ?? '',
        labelOf('partners', item.partner_id),
        [text.location, labelOf('countries', item.country_id)].filter(Boolean).join(', '),
        project ? `${t('catalogue.results.forProject')} ${project}` : '',
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
  // legacy put it, so no controls are declared here. Every text is an
  // entry name.

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
    // The engine reads the raw `items` entity; a per-language build ships
    // every member's `languages` array but not every member's text in this
    // language, and legacy 404s such a record (`itemById`'s own rule, in
    // useExhibitionData.js). The results page must not offer what the sheet
    // would refuse to open, so it is filtered to the same renderable
    // subset.
    scope: (item) => itemById.value.has(item.id),
    dates: { mode: DATE_MODE, begin: 'from', end: 'to' },
    sort: { undated: 'first' },
    pageSize: PAGE_SIZE,
    variant: 'grid',
    recordRoute: 'item',
    actionLabel: 'exhibition.action.seeDatabaseEntry',
    empty: 'catalogue.results.noResults',
    pagination: { jump: true },

    record: (item, { t }) => tile(item, t),

    summary: ({ filters, pageInfo, t }) => [
      { label: t('exhibition.section.collection'), value: filterSummary(filters, t) },
      { count: pageInfo.total, value: `${t('catalogue.results.outOf')} ${itemById.value.size} ${t('catalogue.results.objects')}` },
    ],
  }

  return { FACETS, haystack, tile, collectionResults, countryIdForCode, tagLabelForLegacy }
}
