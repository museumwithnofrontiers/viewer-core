// Two date rules, both legacy, never merged.
//
// The standalone sites (Islamic Art, Baroque Art, Sharing History) test
// overlap, tolerating a record that carries one date only: "from 800" keeps
// a record whose end is at or after 800, or — with no end — whose start is.
// The DXA sites (the galleries and exhibitions) test containment, the
// predicate of legacy's `Objects.blade.php`: `na <= start_date` and
// `nz >= coalesce(end_date, start_date)`, so an undated record is out the
// moment a bound is set. They give different answers on the same data, and
// each website has published its answer for years. A site names its rule
// once, in its catalogue spec; this file only makes sure the two cannot be
// confused for one.

const number = (value) => {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const year = (record, field) => {
  const value = record?.[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Whether `record` falls in `[begin, end]` under `mode`: `'overlap'` (the
 * standalone rule) or `'contain'` (the DXA rule). A bound that is empty or
 * absent is not applied. `fields` names the record's start and end properties.
 */
export function inDateRange(record, { begin, end, mode = 'overlap', fields = {} } = {}) {
  const from = number(begin)
  const to = number(end)
  const start = year(record, fields.start ?? 'start_date')
  const last = year(record, fields.end ?? 'end_date')

  if (mode === 'contain') {
    if (from != null && (start == null || from > start)) return false
    if (to != null) {
      const final = last ?? start
      if (final == null || to < final) return false
    }
    return true
  }
  if (mode !== 'overlap') throw new Error(`Unknown date mode "${mode}": use "overlap" or "contain"`)

  if (from != null) {
    if (last != null) {
      if (last < from) return false
    } else if (start != null && start < from) return false
  }
  if (to != null) {
    if (start != null) {
      if (start > to) return false
    } else if (last != null && last > to) return false
  }
  return true
}

/** The records of `list` that `inDateRange` keeps. */
export function dateRange(list, options = {}) {
  return (list ?? []).filter((record) => inDateRange(record, options))
}

// ── Year buckets ───────────────────────────────────────────────────────────
//
// A verbatim port of `loadYears` in the legacy DXA client's collection.js
// mixin, carried here from four identical copies. The API returned only a
// min and a max; the client built the era buckets itself, with coarser steps
// the further back you go (500 → 250 → 100 → 50), an explicit "Before 1000
// BC" bucket, and an "After …" label when the final step is short. The
// algorithm is reproduced rather than improved because its values end up in
// shareable URLs, and a nicer bucket is a broken link.

const nextMultiple = (n, m) => Math.ceil(n / m) * m
const previousMultiple = (n, m) => Math.floor(n / m) * m

function pushIncrements(from, maxRounded, incrementMax, increment, array) {
  for (let i = from; i <= incrementMax; i += increment) {
    if (i > maxRounded) return
    array.push(i)
  }
}

/**
 * The era buckets between `min` and `max`, as `[{ value, label }]`. The era
 * words on the labels are texts (`catalogue.era.bc`, `.ad`, `.before`,
 * `.after`) and the years are not, which is why `t` comes in from the caller
 * and the two are joined here rather than written into an entry with a hole
 * in it.
 */
export function yearBucketsFromRange(min, max, t) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []

  const increments = [500, 250, 100, 50]
  let smallestIncrement
  const array = [min]
  let minRounded, maxRounded

  if (max >= 1800) maxRounded = previousMultiple(max, increments[3])
  else if (max >= 1000) maxRounded = previousMultiple(max, increments[2])
  else if (max >= 0) maxRounded = previousMultiple(max, increments[1])
  else maxRounded = previousMultiple(max, increments[0])

  if (min <= 0) minRounded = nextMultiple(min, increments[0])
  else if (min <= 1000) minRounded = nextMultiple(min, increments[1])
  else if (min <= 1800) minRounded = nextMultiple(min, increments[2])
  else minRounded = nextMultiple(min, increments[3])

  let guard = 0
  do {
    if (minRounded < 0) {
      pushIncrements(minRounded, maxRounded, 0, increments[0], array)
      smallestIncrement = increments[0]
    } else if (minRounded < 1000) {
      pushIncrements(minRounded, maxRounded, 1000, increments[1], array)
      smallestIncrement = increments[1]
    } else if (minRounded < 1800) {
      pushIncrements(minRounded, maxRounded, 1800, increments[2], array)
      smallestIncrement = increments[2]
    } else {
      pushIncrements(minRounded, maxRounded, maxRounded, increments[3], array)
      smallestIncrement = increments[3]
    }
    const last = array[array.length - 1]
    // The legacy loop relies on the array growing; if a step adds nothing it
    // would spin forever. Legacy never hit that because its data always did.
    if (last === minRounded && guard++ > 0) break
    minRounded = last
  } while (array[array.length - 1] < maxRounded && guard++ < 64)

  array.push(max)
  const unique = [...new Set(array)]

  const labelled = []
  for (const value of unique) {
    if (value < 0) labelled.push({ value, label: `${Math.abs(value)} ${t('catalogue.era.bc')}` })
    else if (value > 0) labelled.push({ value, label: `${value} ${t('catalogue.era.ad')}` })
  }
  if (!labelled.length) return []

  let display = labelled
  if (labelled[0].value < -1000) {
    display = labelled.filter(({ value }) => value >= -1000)
    display.unshift({ value: min, label: `${t('catalogue.era.before')} 1000 ${t('catalogue.era.bc')}` })
  }

  if (display.length > 1) {
    const lastGap = display[display.length - 1].value - display[display.length - 2].value
    if (lastGap < smallestIncrement) {
      const previous = display[display.length - 2]
      display[display.length - 1] = {
        value: display[display.length - 1].value,
        label: `${t('catalogue.era.after')} ${previous.label}`,
      }
    }
  }
  return display
}

/** The buckets spanning the dates of `records` (`start_date` to `end_date ?? start_date`). */
export function yearBuckets(records, t, { fields = {} } = {}) {
  const startField = fields.start ?? 'start_date'
  const endField = fields.end ?? 'end_date'
  const starts = []
  const ends = []
  for (const record of records ?? []) {
    const start = year(record, startField)
    const end = year(record, endField) ?? start
    if (start != null) starts.push(start)
    if (end != null) ends.push(end)
  }
  if (!starts.length || !ends.length) return []
  return yearBucketsFromRange(Math.min(...starts), Math.max(...ends), t)
}

/**
 * "1193 AD" / "502 BC" — legacy's era suffix rule, for a year on its own.
 * Nothing for a year that is missing or zero.
 */
export function eraLabel(year, t) {
  if (!Number.isFinite(year) || year === 0) return ''
  return year < 0 ? `${Math.abs(year)} ${t('catalogue.era.bc')}` : `${year} ${t('catalogue.era.ad')}`
}

/**
 * `t`, with a family's own era words: `words` maps a `catalogue.era.*`
 * entry to the one to read instead (the galleries' "A.D." and "B.C.",
 * `GALLERY_ERA_WORDS`). Every other entry reads as before; no `words`, `t`.
 */
export function withEraWords(t, words) {
  if (!words) return t
  return (key, ...rest) => t(words[key] ?? key, ...rest)
}

/**
 * A record's dates rounded outward to the century, the window legacy's
 * "Timeline for this item" opens, so a single-year object still lands on a
 * readable stretch of chronology. `[from, to]`, either null when unknown.
 */
export function roundOutward(start, end) {
  const from = Number.isFinite(start) ? Math.floor(start / 100) * 100 : null
  const last = Number.isFinite(end) ? end : start
  const to = Number.isFinite(last) ? Math.ceil(last / 100) * 100 : null
  return [from, to]
}

/**
 * The century boundaries that three Database forms build locally, reproducing
 * legacy `database.php:88–124`. The asymmetry between the two lists is preserved.
 * The default range (501–2000) is the same as the legacy form's initial state.
 */
export function centuryPresets({ from = 501, to = 2000 } = {}) {
  const fromOptions = Array.from({ length: 16 }, (_, i) => 501 + i * 100)
  const toOptions = Array.from({ length: 15 }, (_, i) => 600 + i * 100)
  return {
    from: fromOptions,
    to: toOptions,
  }
}
