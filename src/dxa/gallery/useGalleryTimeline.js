import { computed } from 'vue'
import { dateRange, eraLabel, roundOutward, yearBucketsFromRange } from '../../catalogue/dates.js'
import { useTimelineEvents } from '../../catalogue/timeline.js'
import { PAGE_SIZE } from '../shared.js'

export { eraLabel, roundOutward }

/**
 * The gallery's timeline spec, over its data layer's `data` and the
 * `PAGE_SIZE`/`tile` its {@link import('./useGalleryCollection.js').useGalleryCollection}
 * already declared.
 *
 * Reads `data.timelines`, `data.countries`, `data.countryById`,
 * `data.labelOf`, `data.items`, `data.tr`, `data.loadTranslations`,
 * `data.defaultLang`. `config` carries nothing today.
 */
export function useGalleryTimeline(data, collection, config = {}) {
  void config
  const { timelines, countries, countryById, labelOf, items, tr, loadTranslations, defaultLang } = data
  const { tile } = collection

  // `TimelineResultsView` takes `tr` as a plain callback rather than an
  // entity name, unlike `CatalogueResultsView`/`RecordView`, which load
  // their own entity's English translations when they mount. Nothing does
  // that for this one, so it is done here, once, the moment this composable
  // is created.
  loadTranslations('timeline_events', defaultLang)

  // The merge itself — the worldwide country chronology, `mwnf3.hcr`
  // combined with Sharing History's exhibition-2 rows the way legacy's
  // `/v2/events` served it — is viewer-core's `useTimelineEvents`. What
  // stays here is what is genuinely a gallery's own: the DXA legacy
  // 2-letter country code (a gallery's Timeline URLs are keyed on it, not
  // on the inventory id) and the two specs the composed views render from.
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

  // `TimelineResultsView`'s own country control (`countries` from
  // viewer-core) writes the inventory id, not the legacy code
  // (`?country=dza`, not `?country=dz`); `countryIdForCode` used to answer
  // nothing for one, silently matching every event. Built once, next to
  // `LEGACY_TO_ISO`, rather than inside the function it is read from.
  const countryIdSet = computed(() => new Set(countries.value.map((c) => c.id)))

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

  /** Display name for a country the chronology carries, keyed by inventory id. */
  function countryLabel(countryId) {
    if (countries.value.some((c) => c.id === countryId)) return labelOf('countries', countryId)
    const timeline = timelines.value.find((t) => t.country_id === countryId)
    return timeline ? nameFor(timeline) : countryId
  }

  /**
   * Legacy 2-letter code → the inventory country id the events are keyed
   * by. A country served by both chronologies has two rows carrying the
   * same code and the same `country_id`, so either row answers.
   */
  function countryIdForCode(code) {
    if (!code || code === 'all') return null
    // Already an id (the composed view's own control writes one): pass it
    // through unchanged, before the legacy-code lookups below get a chance
    // to find nothing and silently match every event.
    if (countryIdSet.value.has(code)) return code
    const timeline = timelines.value.find((t) => legacyCodeOf(t) === code)
    if (timeline) return timeline.country_id
    // Countries with no chronology still reach here from the collection
    // page's "Timeline for this Search" link, which uses countries.json's
    // own codes.
    return countries.value.find((c) => c.code === code)?.id ?? null
  }

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
