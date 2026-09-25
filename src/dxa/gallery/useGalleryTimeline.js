import { dateRange, eraLabel, roundOutward, yearBucketsFromRange } from '../../catalogue/dates.js'
import { useTimelineEvents } from '../../catalogue/timeline.js'
import { PAGE_SIZE } from '../shared.js'

export { eraLabel, roundOutward }

/**
 * The gallery's timeline spec, over its data layer's `data` and the
 * `PAGE_SIZE`/`tile` its {@link import('./useGalleryCollection.js').useGalleryCollection}
 * already declared.
 *
 * Reads `data.labelOf`, `data.items`, `data.tr`, `data.loadTranslations`,
 * `data.defaultLang`, `data.countryIdForCode`, `data.countryLabel`.
 * `config` carries nothing today.
 */
export function useGalleryTimeline(data, collection, config = {}) {
  void config
  const { labelOf, items, tr, loadTranslations, defaultLang, countryIdForCode, countryLabel } = data
  const { tile } = collection

  // `TimelineResultsView` takes `tr` as a plain callback rather than an
  // entity name, unlike `CatalogueResultsView`/`RecordView`, which load
  // their own entity's English translations when they mount. Nothing does
  // that for this one, so it is done here, once, the moment this composable
  // is created.
  loadTranslations('timeline_events', defaultLang)

  // The merge itself — the worldwide country chronology, `mwnf3.hcr`
  // combined with Sharing History's exhibition-2 rows the way legacy's
  // `/v2/events` served it — is viewer-core's `useTimelineEvents`, and the
  // DXA legacy 2-letter country code a gallery's Timeline URLs are keyed on
  // is the data layer's (`countryIdForCode`, `countryLabel`). What stays
  // here is what is genuinely a gallery's own: the two specs the composed
  // views render from.

  /**
   * The one merge engine every Timeline page on a gallery shares —
   * worldwide, project-independent, which is why it works even though a
   * gallery's own `has_country_timeline` flag is false, exactly as on the
   * live site. `TimelineResultsView`'s two instances (entrance, results)
   * each read the spec below and build their own; the item sheet's
   * "Timeline for this item" widget is the one place that reads it
   * directly, for a per-item country and range the composed view has no
   * shape for.
   */
  const timelineEvents = useTimelineEvents({
    scope: 'country',
    countryLabel,
    countryIdForCode,
    tr: (id) => tr('timeline_events', id, defaultLang),
  })

  // ── The gallery join ──────────────────────────────────────────────────
  //
  // Legacy's timeline-gallery page joined events to member items by country
  // and year range client-side; the package spec anticipated exactly this.
  // Overlap, not containment: a period is a window on the chronology, and
  // an object made across its edge belongs in it.

  function inTimelineScope(item, countryCode) {
    const countryId = countryIdForCode(countryCode)
    return Number.isFinite(item.start_date) && (!countryId || item.country_id === countryId)
  }

  /** The member items in `filters.country`'s period — the "See gallery" count. */
  function timelineGalleryItems({ country, begin, end } = {}) {
    const list = (items.value ?? []).filter((i) => inTimelineScope(i, country))
    return dateRange(list, { begin, end, mode: 'overlap' })
  }

  // ── The entrance and results page, as one spec ─────────────────────────
  //
  // What viewer-layout's `TimelineResultsView` renders on `/timeline`
  // (entrance: true) and `/timeline-results` (entrance: false): the
  // country and period controls, the events list, and the "See gallery"
  // cross-link — shown whenever the chosen country and period actually
  // contain member items, for every country including "all".

  const timelineResults = {
    scope: 'country',
    countryLabel,
    countryIdForCode,
    tr: (id) => tr('timeline_events', id, defaultLang),
    route: 'timeline-results',
    controls: [
      { key: 'country' },
      { key: 'begin', options: (ctx) => yearBucketsFromRange(ctx.years.min, ctx.years.max, ctx.t) },
      { key: 'end', options: (ctx) => yearBucketsFromRange(ctx.years.min, ctx.years.max, ctx.t) },
    ],
    gallery: {
      route: 'timeline-gallery',
      items: (ctx) => timelineGalleryItems(ctx.filters),
    },
  }

  // ── The gallery page, as a spec ─────────────────────────────────────────
  //
  // What viewer-layout's `CatalogueResultsView` renders on
  // `/timeline/gallery`: the same country-and-period join as the cross-link
  // above, over the member items, undated last, nine tiles a page. No
  // facets or controls: the country and period travel from the timeline
  // results page, not from this page's own form.

  const timelineGallery = {
    entity: 'items',
    // Named explicitly: there are no facets here for the default key list
    // to infer 'country' from, only the join's own scope function.
    keys: ['country', 'begin', 'end'],
    scope: (item, filters) => inTimelineScope(item, filters.country),
    dates: { mode: 'overlap' },
    sort: { undated: 'first' },
    pageSize: PAGE_SIZE,
    variant: 'grid',
    recordRoute: 'item',
    actionLabel: 'gallery.action.seeDatabaseEntry',
    empty: 'gallery.results.noObjectsInPeriod',
    pagination: { jump: true },

    record: (item, { t }) => tile(item, t),

    summary: ({ filters, pageInfo, t }) => {
      const countryId = countryIdForCode(filters.country)
      const begin = filters.begin ? Number(filters.begin) : null
      const end = filters.end ? Number(filters.end) : null
      const parts = [{
        label: t('timeline.results.galleryHeading'),
        value: countryId ? labelOf('countries', countryId) : t('timeline.form.allCountries'),
      }]
      if (begin != null || end != null) {
        const from = begin != null ? eraLabel(begin, t) : t('timeline.form.earliest')
        const to = end != null ? eraLabel(end, t) : t('timeline.form.latest')
        parts.push({ value: `${from} ${t('timeline.form.to')} ${to}` })
      }
      parts.push({ count: pageInfo.total, value: t('catalogue.results.objects') })
      return parts
    },
  }

  return { countryLabel, countryIdForCode, timelineEvents, timelineGalleryItems, timelineResults, timelineGallery }
}
