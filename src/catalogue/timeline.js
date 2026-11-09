import { computed } from 'vue'
import { entityRef } from '../composables/useEntities.js'
import { eraLabel, yearBucketsFromRange } from './dates.js'

// The country chronology (`hcr` in legacy) is one merged, year-ordered list
// per country, served by legacy `/v2/events` and reproduced identically on
// every gallery and standalone site. An exhibition can instead carry its own
// narrative chronology (`source: 'thg_local'` — legacy's `/thg/timeline`),
// which has no country of its own and is never interleaved with the merge.
// Sharing History's Timeline additionally splits the merge by the exhibition
// each event belongs to (`collection_id` on its timeline row, `null` for the
// Permanent Collection). Every one of the seven websites' Timeline pages is
// one of these three axes over the same event shape — this is the one place
// that shape is read.
//
// The event overlap rule was triplicated verbatim (islamicart, baroqueart,
// sharinghistory) and mirrors legacy `class.hcr.inc.php`'s SQL; carpets and
// water-in-islam wrote a related but distinct copy for the DXA sites. Both
// are ported here rather than merged into a fourth variant, because the two
// already ship identical answers on the cases that matter (see the tests):
// the only real divergence was which of the three label rules a site reached
// for, which is now one function trying all three in the order the data
// disambiguates them.
//
// What stays out, by design: the DXA legacy 2-letter country code
// (`legacyCodeOf`/`nameFor` in carpets and water-in-islam) — parsing
// `backward_compatibility` and falling back to `Intl.DisplayNames` is a
// concern of the sites still keying their Timeline URLs on that code, not of
// the merge itself. Those sites pass `countryIdForCode` to translate their
// code back to the id this module filters on.

/** `year_to === 0` mirrors the legacy convention for an open-ended period. */
export function effectiveYearTo(event) {
  return event?.year_to && event.year_to !== 0 ? event.year_to : null
}

/**
 * Whether `event` falls in `[begin, end]`, either bound optional — legacy's
 * `class.hcr.inc.php` rule: an event with a known end overlaps once that end
 * is past `begin` and its start is before `end`; an open-ended event (no
 * known end) overlaps on its start alone. An event with no `year_from` at
 * all never overlaps a bounded search — there is nothing to compare — but
 * still matches a search with no bound, the same as every dated event does.
 */
export function overlapsRange(event, begin, end) {
  const yf = event?.year_from
  const yt = effectiveYearTo(event)
  if (begin == null && end == null) return true
  if (!Number.isFinite(yf)) return false
  if (begin != null && end != null) {
    return yt !== null ? yt > begin && yf < end : yf > begin && yf < end
  }
  if (begin != null) return yt !== null ? yt > begin : yf > begin
  return yf <= end
}

/**
 * Whether `event` falls in `[begin, end]` by an exhibition's own chronology,
 * legacy's `/thg/timeline?na=&nz=`: unlike the country rule above, its bounds
 * are inclusive, so an event ending the year a search begins, or beginning
 * the year it ends, is in it. An event with no known end is its start year.
 */
export function touchesRange(event, begin, end) {
  const yf = event?.year_from
  if (begin == null && end == null) return true
  if (!Number.isFinite(yf)) return false
  const yt = effectiveYearTo(event) ?? yf
  return (begin == null || yt >= begin) && (end == null || yf <= end)
}

/**
 * The label under an event, trying the three rules the sites share in the
 * order the data disambiguates them: a curated description pair
 * (`date_from_description`/`date_to_description`, for an event whose date
 * is imprecise in a way a bare year cannot say — every package's named event
 * carries a date description too, so the title is not a date), a narrative
 * chronology's own period name (`text.name`, a sort key, only tried when an
 * event has no date description at all), and failing both, the derived year
 * range through `eraLabel` — the one reached for by the worldwide country
 * merge, which has neither.
 */
export function eventDateLabel(event, text, t) {
  if (text?.date_from_description) {
    // Legacy printed the pair only when the two differ; the era branch
    // collapses an equal year_from/year_to the same way. Trim before
    // comparing so that whitespace doesn't bloat the display.
    if (text.date_to_description?.trim() === text.date_from_description.trim()) {
      return text.date_from_description
    }
    return text.date_to_description
      ? `${text.date_from_description} – ${text.date_to_description}`
      : text.date_from_description
  }
  if (text?.name) return text.name
  if (!Number.isFinite(event?.year_from)) return ''
  const from = eraLabel(event.year_from, t)
  const yt = effectiveYearTo(event)
  return yt !== null ? `${from} – ${eraLabel(yt, t)}` : `${from} –`
}

/**
 * The engine of a Timeline results page, one implementation for the three
 * axes legacy split across separate endpoints:
 *
 * - `'country'` — the worldwide country merge (galleries, and the standalone
 *   sites that offer only this axis);
 * - `'local'` — an exhibition's own narrative chronology in place of the
 *   merge (the `thg_local` timeline row), no country picker;
 * - `'collection'` — the merge again, plus filtering by which exhibition an
 *   event's timeline is bound to (`null` = the Permanent Collection), for
 *   Sharing History's second axis.
 *
 * `countryLabel(countryId)` names a country for the picker and is the
 * site's own — a country reads as its name, which this module has no way to
 * know. `countryIdForCode`, if given, resolves a `findEvents({ country })`
 * value through the site's own legacy-code table before filtering; omit it
 * and `country` is already the id. `tr(id)` returns an event's translated
 * fields already resolved for entity and language — the site's own `tr`,
 * bound the way every data composable already binds it. `timelinesEntity`
 * / `eventsEntity` name the data package files, for a site that calls its
 * own something else.
 */
export function useTimelineEvents({
  scope = 'country',
  countryLabel,
  countryIdForCode,
  tr,
  timelinesEntity = 'timelines',
  eventsEntity = 'timeline_events',
} = {}) {
  const timelines = entityRef(timelinesEntity)
  const events = entityRef(eventsEntity)

  // The narrative chronology has no country of its own, so it must be kept
  // out of the merge by `source` rather than by the country filter — on "all
  // countries" it would otherwise interleave into the worldwide list.
  const localTimeline = computed(
    () => (timelines.value ?? []).find((row) => row.source === 'thg_local') ?? null,
  )

  const timelineById = computed(() => new Map((timelines.value ?? []).map((row) => [row.id, row])))

  /** The events this scope works over — one chronology, never both. */
  const eventPool = computed(() => {
    const all = events.value ?? []
    const local = localTimeline.value
    if (scope === 'local') return local ? all.filter((event) => event.timeline_id === local.id) : []
    return local ? all.filter((event) => event.timeline_id !== local.id) : all
  })

  const hasTimeline = computed(() => eventPool.value.length > 0)
  const usesLocalTimeline = computed(() => scope === 'local' && Boolean(localTimeline.value))

  /**
   * Countries that actually have a chronology, alphabetized by label, with
   * an "all" marker first — the marker carries no label of its own, so the
   * picker renders it through its own catalogue entry. No picker at all for
   * `'local'`: legacy hides the country select once the section is the
   * exhibition's own chronology, because there is nothing to filter by.
   */
  const countries = computed(() => {
    if (scope === 'local') return []
    const seen = new Map()
    for (const row of timelines.value ?? []) {
      if (!row.country_id || seen.has(row.country_id)) continue
      seen.set(row.country_id, {
        value: row.country_id,
        label: countryLabel ? countryLabel(row.country_id) : row.country_id,
      })
    }
    const rows = [...seen.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)))
    return [{ value: 'all', label: null }, ...rows]
  })

  /** Every event year present in this scope, as the year picker's source range. */
  const yearRange = computed(() => {
    const years = eventPool.value
      .map((event) => event.year_from)
      .filter((value) => Number.isFinite(value) && value !== 0)
    if (!years.length) return [null, null]
    return [Math.min(...years), Math.max(...years)]
  })

  /** The legacy era buckets over this scope's year range. */
  function yearBuckets(t) {
    const [min, max] = yearRange.value
    return yearBucketsFromRange(min, max, t)
  }

  function resolveCountryId(country) {
    if (country == null || country === 'all') return null
    return countryIdForCode ? countryIdForCode(country) : country
  }

  // `null` is Sharing History's Permanent Collection sentinel — a timeline
  // bound to no exhibition — so it must be told apart from "no filter",
  // which `collection: undefined` spells instead.
  function matchesCollection(event, collection) {
    const collectionId = timelineById.value.get(event.timeline_id)?.collection_id ?? null
    return collection === null ? collectionId === null : collectionId === collection
  }

  /**
   * Legacy's `/events?ic[]=&ya=&yo=` (and Sharing History's exhibition
   * filter alongside it) — this scope's events in `[begin, end]`, for the
   * given country and/or collection, chronological. `display_order` breaks a
   * tie on `year_from`, the order the exhibition itself gave two events of
   * the same year; an event with no year at all has no place in that order
   * and sorts after every dated one.
   */
  function findEvents({ country, collection, begin, end } = {}) {
    const countryId = resolveCountryId(country)
    const from = begin === '' || begin == null ? null : Number(begin)
    const to = end === '' || end == null ? null : Number(end)

    return eventPool.value
      .filter((event) => {
        // A narrative chronology's events carry no country_id at all — the
        // filter has nothing to apply itself to, the same reason `countries`
        // renders no picker for this scope.
        if (scope !== 'local' && countryId && event.country_id !== countryId) return false
        if (collection !== undefined && !matchesCollection(event, collection)) return false
        return scope === 'local' ? touchesRange(event, from, to) : overlapsRange(event, from, to)
      })
      .map((event) => ({ ...event, text: tr ? tr(event.id) : {} }))
      .sort((a, b) => {
        const ya = Number.isFinite(a.year_from) ? a.year_from : Infinity
        const yb = Number.isFinite(b.year_from) ? b.year_from : Infinity
        return ya - yb || (a.display_order ?? 0) - (b.display_order ?? 0)
      })
  }

  return { countries, yearRange, yearBuckets, hasTimeline, usesLocalTimeline, findEvents }
}
