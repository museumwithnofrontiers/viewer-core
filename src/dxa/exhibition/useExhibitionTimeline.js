import { computed } from 'vue'
import { eraLabel, roundOutward, yearBucketsFromRange } from '../../catalogue/dates.js'
import { useTimelineEvents } from '../../catalogue/timeline.js'
import { PAGE_SIZE } from '../shared.js'

export { eraLabel, roundOutward }

/**
 * The exhibition's timeline spec, over its data layer's `data` and the
 * `PAGE_SIZE`/`tile` its {@link import('./useExhibitionCollection.js').useExhibitionCollection}
 * already declared.
 *
 * Reads `data.exhibition`, `data.timelines`, `data.items`, `data.tr`,
 * `data.defaultLang`, `data.countryIdForCode`, `data.countryLabel`.
 * `config` carries nothing today.
 */
export function useExhibitionTimeline(data, collection, config = {}) {
  void config
  const { exhibition, timelines, items, tr, defaultLang, countryIdForCode, countryLabel } = data
  const { tile } = collection

  // ── Which chronology this site's Timeline section shows ─────────────────
  //
  // An exhibition package carries BOTH chronologies, because the live
  // instance serves both: `/events` answers the worldwide country merge on
  // every DXA site, and `/thg/timeline` answers the exhibition's own
  // narrative one. What decides which the *Timeline pages* show is
  // `hasCountryBasedTimeline`: legacy's TimelinePage sets
  // `countriesAvailable` from it and TimelineResults switches its endpoint
  // on it (`timelineURL = "/thg/timeline?hash="` in the false branch).
  //
  // Both flags may be false for an exhibition, and that does NOT mean "no
  // timeline data". `timelines.json` still ships the worldwide merge in
  // full — every DXA site gets the worldwide merge whatever its flags say —
  // possibly with no `thg_local` row at all. The flags gate NAVIGATION, not
  // data.
  const localTimeline = computed(
    () => (timelines.value ?? []).find((t) => t.source === 'thg_local') ?? null,
  )

  /** True when the Timeline section is the exhibition's own chronology. */
  const usesLocalTimeline = computed(
    () => !exhibition.value?.has_country_timeline && Boolean(localTimeline.value),
  )

  /**
   * Whether this site offers a Timeline at all — the one flag every piece
   * of timeline chrome is gated on.
   *
   * Legacy hides more than the nav entry when both chronology flags are
   * false, which is only visible on a site that has them both false. The
   * ROUTES stay reachable, because legacy's do: typing /timeline on a live
   * instance with both flags false still renders the page and its
   * introduction. Only the links into it are withheld.
   */
  const hasTimeline = computed(
    () => Boolean(exhibition.value?.has_timeline || exhibition.value?.has_country_timeline),
  )

  const eventsTr = (id) => tr('timeline_events', id, defaultLang)

  // ── The events ───────────────────────────────────────────────────────
  //
  // viewer-core's `useTimelineEvents` is the one engine over both
  // chronologies: the worldwide country merge (`scope: 'country'`, which
  // keeps the `thg_local` row out of it by `source`, since that row has no
  // country to filter on) and the exhibition's own narrative one
  // (`scope: 'local'`). The exhibition's flags pick between them once the
  // exhibition record has loaded, so both are built and `timelineEvents`
  // reads the one in force. The item page's "Timeline for this item" popout
  // reads it; the Timeline pages build their own from `timelineSpec` below.
  const engine = { countryLabel, countryIdForCode, tr: eventsTr }
  const countryEvents = useTimelineEvents({ scope: 'country', ...engine })
  const localEvents = useTimelineEvents({ scope: 'local', ...engine })
  const inForce = () => (usesLocalTimeline.value ? localEvents : countryEvents)

  const timelineEvents = {
    countries: computed(() => inForce().countries.value),
    yearRange: computed(() => inForce().yearRange.value),
    yearBuckets: (t) => inForce().yearBuckets(t),
    findEvents: (filters) => inForce().findEvents(filters),
  }

  // ── The Timeline entrance/results spec ───────────────────────────────
  //
  // Feeds `TimelineResultsView`: the engine owns the country/local axis,
  // the year buckets and the pagination; an exhibition supplies only what
  // is its own — the local/country scope switch and the controls it drives
  // (no country picker when the section is the exhibition's own
  // chronology), and the "See Gallery" join against member items, which
  // stays here because an item's own shape (what counts as "in this
  // period") is the site's, not the package's.

  function yearOptions({ years, t }) {
    return yearBucketsFromRange(years.min, years.max, t)
  }

  /** The member items overlapping a country and period, for the gallery link. */
  function galleryItems({ filters }) {
    const countryId = countryIdForCode(filters.country)
    const from = filters.begin ? Number(filters.begin) : null
    const to = filters.end ? Number(filters.end) : null
    return items.value.filter((i) => {
      if (countryId && i.country_id !== countryId) return false
      const itemStart = i.start_date
      const itemEnd = i.end_date ?? i.start_date
      if (!Number.isFinite(itemStart)) return false
      if (from != null && itemEnd < from) return false
      if (to != null && itemStart > to) return false
      return true
    }).length
  }

  const timelineSpec = computed(() => ({
    scope: usesLocalTimeline.value ? 'local' : 'country',
    countryLabel,
    countryIdForCode,
    tr: eventsTr,
    controls: usesLocalTimeline.value
      ? [{ key: 'begin', options: yearOptions }, { key: 'end', options: yearOptions }]
      : [{ key: 'country' }, { key: 'begin', options: yearOptions }, { key: 'end', options: yearOptions }],
    route: 'timeline-results',
    gallery: { route: 'timeline-gallery', items: galleryItems },
  }))

  // ── The gallery spec ────────────────────────────────────────────────
  //
  // `CatalogueResultsView` over the same country/period join `galleryItems`
  // counts for the "See Gallery" link above — the query keys are the
  // results spec's own `begin`/`end` (viewer-layout's `TimelineResultsView`
  // renders those controls by that name, not `start`/`end`), so the legacy
  // `/timeline-gallery/:country/:start/:end/:page` redirect is renamed to
  // match on the way in.
  const timelineGallerySpec = {
    entity: 'items',
    keys: ['country', 'begin', 'end'],
    scope: (item, filters) => {
      if (!Number.isFinite(item.start_date)) return false
      const countryId = countryIdForCode(filters.country)
      return !countryId || item.country_id === countryId
    },
    dates: { mode: 'overlap', begin: 'begin', end: 'end' },
    sort: { undated: 'first' },
    pageSize: PAGE_SIZE,
    variant: 'grid',
    recordRoute: 'item',
    actionLabel: 'catalogue.results.seeDatabaseEntry',
    empty: 'exhibition.results.noObjectsInPeriod',
    record: (item, { t }) => tile(item, t),
    summary: ({ filters, pageInfo, t }) => [
      {
        label: t('timeline.results.galleryHeading'),
        value: filters.country
          ? countryLabel(countryIdForCode(filters.country))
          : t('timeline.form.allCountries'),
      },
      { count: pageInfo.total, value: t('catalogue.results.objects') },
    ],
  }

  return {
    usesLocalTimeline, hasTimeline, countryLabel, countryIdForCode,
    timelineEvents, timelineSpec, timelineGallerySpec,
  }
}
