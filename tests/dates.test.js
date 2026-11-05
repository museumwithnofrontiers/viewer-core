import { describe, expect, it } from 'vitest'
import { centuryPresets, dateRange, eraLabel, inDateRange, roundOutward, withEraWords, yearBuckets, yearBucketsFromRange } from '../src/index.js'
import { GALLERY_ERA_WORDS } from '../src/dxa/index.js'

const t = (key) => ({ 'catalogue.era.bc': 'BC', 'catalogue.era.ad': 'AD', 'catalogue.era.before': 'Before', 'catalogue.era.after': 'After' })[key] ?? key

const dated = { start_date: 900, end_date: 950 }
const startOnly = { start_date: 1200, end_date: null }
const undated = { start_date: null, end_date: null }

describe('inDateRange', () => {
  // The two rules give different answers on the same records, and each has
  // been a website's answer for years. This pins the difference.
  it('overlap keeps a record whose span touches the window, tolerating one date', () => {
    expect(inDateRange(dated, { begin: 940 })).toBe(true)
    expect(inDateRange(dated, { begin: 951 })).toBe(false)
    expect(inDateRange(dated, { end: 899 })).toBe(false)
    expect(inDateRange(startOnly, { begin: 1000 })).toBe(true)
    expect(inDateRange(startOnly, { begin: 1300 })).toBe(false)
    expect(inDateRange(startOnly, { end: 1100 })).toBe(false)
    expect(inDateRange(undated, { begin: 1, end: 2000 })).toBe(true)
  })

  it('contain keeps a record whose span lies inside the window, and drops the undated', () => {
    expect(inDateRange(dated, { begin: 900, end: 950, mode: 'contain' })).toBe(true)
    expect(inDateRange(dated, { begin: 901, mode: 'contain' })).toBe(false)
    expect(inDateRange(dated, { end: 949, mode: 'contain' })).toBe(false)
    expect(inDateRange(startOnly, { end: 1200, mode: 'contain' })).toBe(true)
    expect(inDateRange(undated, { begin: 1, mode: 'contain' })).toBe(false)
    expect(inDateRange(undated, { end: 2000, mode: 'contain' })).toBe(false)
  })

  it('applies no bound that is empty, and refuses a rule it does not know', () => {
    expect(inDateRange(undated, { begin: '', end: null, mode: 'contain' })).toBe(true)
    expect(() => inDateRange(dated, { begin: 1, mode: 'both' })).toThrow(/Unknown date mode/)
  })

  it('reads other field names', () => {
    expect(inDateRange({ from: 10, to: 20 }, { begin: 15, fields: { start: 'from', end: 'to' } })).toBe(true)
  })

  it('the two rules disagree exactly where they should', () => {
    const records = [dated, startOnly, undated]
    expect(dateRange(records, { begin: 1000, end: 1300 })).toEqual([startOnly, undated])
    expect(dateRange(records, { begin: 1000, end: 1300, mode: 'contain' })).toEqual([startOnly])
  })
})

describe('yearBucketsFromRange', () => {
  // Three ranges whose output the legacy client produced; the values must not
  // move because they end up in shareable URLs.
  it('steps coarsely far back and finely near the present', () => {
    const labels = yearBucketsFromRange(700, 1900, t).map((b) => b.label)
    expect(labels[0]).toBe('700 AD')
    expect(labels).toContain('750 AD')
    expect(labels).toContain('1000 AD')
    expect(labels).toContain('1800 AD')
    expect(labels).toContain('1850 AD')
    expect(labels[labels.length - 1]).toBe('1900 AD')
  })

  it('collapses everything before 1000 BC into one bucket and labels the era', () => {
    const buckets = yearBucketsFromRange(-3000, -500, t)
    expect(buckets[0]).toEqual({ value: -3000, label: 'Before 1000 BC' })
    expect(buckets.map((b) => b.label)).toContain('1000 BC')
    expect(buckets[buckets.length - 1].label).toBe('500 BC')
  })

  it('names a short final step "After"', () => {
    const buckets = yearBucketsFromRange(1800, 1910, t)
    expect(buckets[buckets.length - 1].label).toBe('After 1900 AD')
    expect(buckets[buckets.length - 1].value).toBe(1910)
  })

  it('is empty for no range', () => {
    expect(yearBucketsFromRange(null, 5, t)).toEqual([])
    expect(yearBuckets([{ start_date: null }], t)).toEqual([])
  })

  it('spans the dates of a record set', () => {
    const buckets = yearBuckets([{ start_date: 900, end_date: 950 }, { start_date: 1200 }], t)
    expect(buckets[0].value).toBe(900)
    expect(buckets[buckets.length - 1].value).toBe(1200)
  })
})

describe('eraLabel and roundOutward', () => {
  it('suffixes the era and says nothing for no year', () => {
    expect(eraLabel(1193, t)).toBe('1193 AD')
    expect(eraLabel(-502, t)).toBe('502 BC')
    expect(eraLabel(0, t)).toBe('')
    expect(eraLabel(undefined, t)).toBe('')
  })

  it("reads a family's own era words through withEraWords, every other entry as before", () => {
    const words = { 'gallery.era.ad': 'A.D.', 'gallery.era.bc': 'B.C.' }
    const galleryT = withEraWords((key) => words[key] ?? t(key), GALLERY_ERA_WORDS)
    expect(eraLabel(1193, galleryT)).toBe('1193 A.D.')
    expect(eraLabel(-502, galleryT)).toBe('502 B.C.')
    expect(yearBucketsFromRange(1100, 1350, galleryT).map((o) => o.label)).toEqual(['1100 A.D.', '1200 A.D.', '1300 A.D.', 'After 1300 A.D.'])
    expect(withEraWords(t, null)).toBe(t)
  })

  it('rounds outward to the century, one date standing for both', () => {
    expect(roundOutward(1193, 1250)).toEqual([1100, 1300])
    expect(roundOutward(1193, undefined)).toEqual([1100, 1200])
    expect(roundOutward(undefined, undefined)).toEqual([null, null])
  })
})

describe('centuryPresets', () => {
  it('returns the legacy database form century boundaries', () => {
    const { from, to } = centuryPresets()
    expect(from).toEqual([501, 601, 701, 801, 901, 1001, 1101, 1201, 1301, 1401, 1501, 1601, 1701, 1801, 1901, 2001])
    expect(to).toEqual([600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000])
  })

  it('preserves the asymmetry between from and to (16 vs 15 values)', () => {
    const { from, to } = centuryPresets()
    expect(from.length).toBe(16)
    expect(to.length).toBe(15)
  })
})
