import { computed, toValue } from 'vue'
import { useDataPackage } from '../composables/useDataPackage.js'
import { entityRef } from '../composables/useEntities.js'
import { useI18n } from '../i18n/index.js'
import { renderInline, renderPlain } from '../i18n/markdown.js'
import { dateRange } from './dates.js'
import { useFacets } from './facets.js'
import { useListQuery } from './listQuery.js'
import { sortChronological, usePagination } from './pagination.js'

/**
 * A results page's engine: the records of one entity, narrowed by the filters
 * and the page the URL carries, in order, a page at a time, each drawn as a
 * row. viewer-layout's `CatalogueResultsView` draws it; a page of another
 * shape can call it directly and draw the result its own way.
 *
 * `spec` (an object, a ref or a getter) is the view's spec — its `entity`,
 * `keys`, `facets`, `facetScope`, `scope`, `match`, `narrow`, `dates`,
 * `sort`, `pageSize`, `record`, `recordRoute`, `summary` and `summaryLabel`;
 * see CatalogueResultsView's header for each. `entity` is the route's own,
 * for a `features.entities` page, used when the spec names none.
 *
 * Returns the query state (`filters`, `page`, `active`, `apply`, `reset`,
 * `goToPage`), the records (`records`, `matching`), the facets' `options`,
 * `pageInfo`, the page's `rows`, the `summary` parts, and `state`: all of it
 * in one object, which is what the view hands each of its slots.
 */
export function useCatalogueResults(spec, { entity: routeEntity = '' } = {}) {
  const { t, locale } = useI18n()
  const pkg = useDataPackage()
  const current = computed(() => toValue(spec))

  // Read once, as the URL keys are: a page does not change entity.
  const entity = current.value.entity ?? routeEntity
  const records = entityRef(entity)
  if (entity) pkg.loadTranslations(entity, 'en')

  const dates = current.value.dates
  const keys = current.value.keys ?? [
    ...Object.keys(current.value.facets ?? {}),
    ...(dates ? [dates.begin ?? 'begin', dates.end ?? 'end'] : []),
  ]
  const { filters, page, active, apply, reset, goToPage } = useListQuery({ keys })

  const helpers = {
    t,
    locale,
    tr: (name, id) => pkg.tr(name, id, locale.value, 'en'),
    renderInline,
    renderPlain,
  }

  const matching = computed(() => {
    const s = current.value
    let list = records.value ?? []
    if (s.scope) list = list.filter((record) => s.scope(record, filters, helpers))
    for (const [key, facet] of Object.entries(s.facets ?? {})) {
      const wanted = filters[key]
      if (!wanted) continue
      list = list.filter((record) => facetValues(record, facet).map(String).includes(String(wanted)))
    }
    if (s.match) list = list.filter((record) => s.match(record, filters, helpers))
    if (s.narrow) list = s.narrow(list, filters, helpers)
    if (s.dates) {
      list = dateRange(list, {
        begin: filters[s.dates.begin ?? 'begin'],
        end: filters[s.dates.end ?? 'end'],
        mode: s.dates.mode ?? 'overlap',
        fields: s.dates.fields,
      })
    }
    const sort = s.sort ?? 'chronological'
    if (typeof sort === 'function') return sort(list)
    if (sort === 'chronological') return sortChronological(list)
    if (sort && typeof sort === 'object') return sortChronological(list, sort)
    return list
  })

  const facetSource = computed(() => (current.value.facetScope === 'matching' ? matching.value : records.value ?? []))
  const options = useFacets(facetSource, () => current.value.facets ?? {})
  const pageInfo = usePagination(matching, { page, size: () => current.value.pageSize ?? 20 })

  const recordRoute = computed(() => current.value.recordRoute ?? (routeEntity ? `${routeEntity}-detail` : 'item'))
  function defaultRecord(record) {
    const text = helpers.tr(entity, record.id)
    const name = text.name ?? record.internal_name ?? record.id
    return {
      id: record.id,
      image: record.images?.[0]?.url ?? '',
      imageAlt: renderPlain(String(name)),
      name: renderInline(String(name)),
      meta: [],
      badge: record.type ?? '',
      to: { name: recordRoute.value, params: { id: record.id } },
    }
  }
  const rows = computed(() => pageInfo.value.rows.map((record) => (current.value.record ?? defaultRecord)(record, helpers)))

  const state = computed(() => ({
    filters,
    active: active.value,
    apply,
    reset,
    goToPage,
    matching: matching.value,
    pageInfo: pageInfo.value,
    options: options.value,
  }))

  const summary = computed(() => {
    const s = current.value
    if (s.summary) return s.summary({ ...state.value, t, total: (records.value ?? []).length })
    return [{ label: t(s.summaryLabel ?? 'catalogue.results.itemsFound'), count: pageInfo.value.total }]
  })

  return { entity, records, filters, page, active, apply, reset, goToPage, matching, options, pageInfo, rows, summary, state, helpers }
}

function facetValues(record, facet) {
  if (typeof facet.values === 'function') return [facet.values(record)].flat()
  const raw = record?.[facet.field]
  return Array.isArray(raw) ? raw : [raw]
}
