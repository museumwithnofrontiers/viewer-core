import { computed } from 'vue'
import { eraLabel, roundOutward, yearBucketsFromRange } from '../../catalogue/dates.js'
import { PAGE_SIZE } from '../shared.js'

export { eraLabel, roundOutward }

/**
 * The exhibition's timeline spec, over its data layer's `data` and the
 * `PAGE_SIZE`/`tile` its {@link import('./useExhibitionCollection.js').useExhibitionCollection}
 * already declared.
 *
 * Reads `data.exhibition`, `data.timelines`, `data.timelineEvents`,
 * `data.countries`, `data.countryById`, `data.items`, `data.labelOf`,
 * `data.tr`, `data.defaultLang`. `config` carries nothing today.
 */
export function useExhibitionTimeline(data, collection, config = {}) {
  void config
  const { exhibition, timelines, timelineEvents, countries, countryById, items, labelOf, tr, defaultLang } = data
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
  //
  // The `thg_local` row has no `country_id`, which is exactly why it must
  // be separated by `source` rather than left to the country filter: on
  // "All Countries" it would otherwise be interleaved into the worldwide
  // list.
  const localTimeline = computed(
    () => timelines.value.find((t) => t.source === 'thg_local') ?? null,
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

  /** The events this site's manual Timeline reads (ItemSheet's own popout). */
  const eventPool = computed(() => {
    const local = localTimeline.value
    if (usesLocalTimeline.value) {
      return timelineEvents.value.filter((e) => e.timeline_id === local.id)
    }
    if (!local) return timelineEvents.value
    return timelineEvents.value.filter((e) => e.timeline_id !== local.id)
  })

  // The global country timeline, served by legacy `/v2/events`. It is
  // country-scoped and project-independent, and also a MERGE of two
  // chronologies rather than one table: legacy's `App\MWNF\DAO\v2\Events`
  // unions `mwnf3.hcr` (the Discover Islamic Art country chronologies) with
  // `mwnf3_sharing_history.sh_hcr` restricted to exhibition 2, "Political
  // Context", and sorts the result by year. The package mirrors that: each
  // row of `timelines.json` is tagged `source: 'mwnf3' | 'sharing_history'`,
  // and `timeline_events.json` keys every event by `country_id`.
  //
  // A country can be served by BOTH sources, so anything user-facing must
  // key on the country and never on the timeline row: `findEvents` filters
  // on `country_id`, which is what merges the two chronologies into one
  // year-ordered list the way legacy did.
  //
  // Names and legacy codes both come from countries.json. The exporter
  // scopes that file to "member item countries ∪ their holders' countries ∪
  // the global timeline's countries", so it covers every timeline country —
  // the `Intl.DisplayNames` fallback below is therefore dead code for them,
  // and is kept only so a regressed package degrades to a rendered ISO code
  // rather than a raw id. The `code` countries.json ships is the country's
  // `backward_compatibility`, which is exactly the code legacy's own
  // timeline URLs used, including the ones that are not ISO 3166-1
  // alpha-2 (`uk`, `pa`, `qt`, `rm`, `sb`, `ua`, …). Those are the reason
  // the fallback must stay unreachable rather than merely rare: read as
  // ISO, `ua` is Ukraine and `sb` is the Solomon Islands, where legacy
  // means the UAE and Serbia. Only countries.json can name them correctly.
  const regionNames = (() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      return null
    }
  })()

  // Two legacy codes are not ISO 3166-1 alpha-2.
  const LEGACY_TO_ISO = { uk: 'GB', pa: 'PS' }

  // The set of inventory country ids present in countries.json. Ids and
  // legacy codes are distinct — legacy codes are backward_compatibility
  // values, while ids are the canonical keys in the inventory system.
  const countryIdSet = computed(
    () => new Set(countries.value.map((c) => c.id)),
  )

  // A lookup, not a parse. The fallback exists only for the
  // regressed-package case described above, and it must agree with
  // GLOBAL_TIMELINE_LIKE_PATTERNS in the exporter's timeline exporter: the
  // country sits after the literal `country` segment in BOTH keyspaces
  // (`mwnf3:hcr:country:<cc>` and
  // `mwnf3_sharing_history:sh_hcr:country:<cc>:exhibition:2`), and it is
  // the last segment in only the first — taking the last one yields `2` on
  // the second.
  function legacyCodeOf(timeline) {
    const fromPackage = countryById.value.get(timeline.country_id)?.code
    if (fromPackage) return fromPackage
    const parts = (timeline.backward_compatibility ?? '').split(':')
    const at = parts.indexOf('country')
    return (at >= 0 ? parts[at + 1] : null) || timeline.country_id
  }

  function nameFor(timeline) {
    const fromPackage = countries.value.some((c) => c.id === timeline.country_id)
      ? labelOf('countries', timeline.country_id)
      : null
    if (fromPackage) return fromPackage
    const legacy = legacyCodeOf(timeline)
    const iso = LEGACY_TO_ISO[legacy] ?? String(legacy).toUpperCase()
    try {
      return regionNames?.of(iso) ?? iso
    } catch {
      return iso
    }
  }

  /**
   * Countries that actually have a chronology, alphabetized, "All" first.
   *
   * One entry per COUNTRY, not per timeline row: a country served by BOTH
   * `mwnf3` and `sharing_history` has two rows, and would otherwise appear
   * twice in every country picker on the site. Only the item sheet's own
   * manual "Timeline for this item" picker reads this now — `timelineSpec`
   * below leaves the picker to viewer-core's `useTimelineEvents`.
   */
  const timelineCountries = computed(() => {
    // No picker at all when the section is the exhibition's own chronology
    // — legacy hides the select on `countriesAvailable === false`.
    if (usesLocalTimeline.value) return []
    const byCountry = new Map()
    for (const timeline of timelines.value) {
      if (!timeline.country_id || byCountry.has(timeline.country_id)) continue
      byCountry.set(timeline.country_id, [legacyCodeOf(timeline), nameFor(timeline)])
    }
    const rows = [...byCountry.values()].sort((a, b) => a[1].localeCompare(b[1]))
    return [['all', 'All Countries'], ...rows]
  })

  /** Display name for an event's country — also `timelineSpec`'s `countryLabel`. */
  function timelineCountryName(countryId) {
    if (countries.value.some((c) => c.id === countryId)) return labelOf('countries', countryId)
    const timeline = timelines.value.find((t) => t.country_id === countryId)
    return timeline ? nameFor(timeline) : countryId
  }

  /**
   * Legacy 2-letter code → the inventory country id the events are keyed
   * by. A country served by both chronologies has two rows carrying the
   * same code and the same `country_id`, so either row answers. Idempotent
   * on an id already: `TimelineResultsView`'s own country picker offers
   * ids, so this must resolve BOTH the legacy code a bookmarked or
   * cross-page link carries and the id the picker itself round-trips.
   */
  function countryIdForCode(code) {
    if (!code || code === 'all') return null
    if (countryIdSet.value.has(code)) return code
    if (countryById.value.has(code)) return code
    const timeline = timelines.value.find((t) => legacyCodeOf(t) === code)
    if (timeline) return timeline.country_id
    // Countries with no chronology still reach here from the collection
    // page's "Timeline for this Search" link, which uses countries.json's
    // own codes.
    return countries.value.find((c) => c.code === code)?.id ?? null
  }

  const eventsTr = (id) => tr('timeline_events', id, defaultLang)

  /**
   * Legacy's `/events?ic[]=&ya=&yo=` — events for a country within a year
   * range, ordered chronologically. Kept for the item sheet's own "Timeline
   * for this item" popout, which reads a single item's country and dates
   * rather than a URL's filters and has no results page of its own to hand
   * to `TimelineResultsView`.
   */
  function findEvents({ countryCode, start, end }) {
    const countryId = countryIdForCode(countryCode)
    const from = start === '' || start == null ? null : Number(start)
    const to = end === '' || end == null ? null : Number(end)

    return eventPool.value
      .filter((e) => {
        if (countryId && e.country_id !== countryId) return false
        const year = e.year_from
        if (!Number.isFinite(year)) return false
        if (from != null && year < from) return false
        if (to != null && year > to) return false
        return true
      })
      .map((e) => ({
        ...e,
        countryName: timelineCountryName(e.country_id),
        text: eventsTr(e.id),
      }))
      .sort((a, b) => (a.year_from - b.year_from) || (a.display_order ?? 0) - (b.display_order ?? 0))
  }

  // ── The Timeline entrance/results spec ───────────────────────────────
  //
  // Feeds `TimelineResultsView`: the engine (viewer-core's
  // `useTimelineEvents`) owns the country/local axis, the year buckets and
  // the pagination; an exhibition supplies only what is its own — the
  // legacy country-code table, the local/country scope switch and the
  // controls it drives (no country picker when the section is the
  // exhibition's own chronology), and the "See Gallery" join against
  // member items, which stays here because an item's own shape (what
  // counts as "in this period") is the site's, not the package's.

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
    countryLabel: timelineCountryName,
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
  // match on the way in (the site's own `dataset.config.js`).
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
    actionLabel: 'exhibition.action.seeDatabaseEntry',
    empty: 'exhibition.results.noObjectsInPeriod',
    record: (item, { t }) => tile(item, t),
    summary: ({ filters, pageInfo, t }) => [
      {
        label: t('timeline.results.galleryHeading'),
        value: filters.country
          ? timelineCountryName(countryIdForCode(filters.country))
          : t('timeline.form.allCountries'),
      },
      { count: pageInfo.total, value: t('catalogue.results.objects') },
    ],
  }

  return {
    usesLocalTimeline, hasTimeline, timelineCountries, timelineCountryName, countryIdForCode,
    findEvents, timelineSpec, timelineGallerySpec,
  }
}
