import { beforeAll, describe, expect, it } from 'vitest'
import {
  effectiveYearTo, eventDateLabel, loadEntities, overlapsRange, touchesRange, useTimelineEvents,
} from '../src/index.js'
import translations from './fixtures/data-package/translations/timeline_events.en.json'

const t = (key) => ({
  'catalogue.era.bc': 'BC', 'catalogue.era.ad': 'AD', 'catalogue.era.before': 'Before', 'catalogue.era.after': 'After',
})[key] ?? key

const countryLabel = (id) => ({ 'c-eg': 'Egypt', 'c-sy': 'Syria' })[id] ?? id
const tr = (id) => translations[id] ?? {}

beforeAll(() => loadEntities(['timelines', 'timeline_events']))

describe('effectiveYearTo', () => {
  it('treats 0 and null as open-ended, everything else as the end year', () => {
    expect(effectiveYearTo({ year_to: 950 })).toBe(950)
    expect(effectiveYearTo({ year_to: 0 })).toBeNull()
    expect(effectiveYearTo({ year_to: null })).toBeNull()
    expect(effectiveYearTo({})).toBeNull()
  })
})

describe('overlapsRange', () => {
  // Pinned against legacy `class.hcr.inc.php`'s two-sided clause: an event
  // with a known end overlaps once that end is past `begin` and its start is
  // before `end`; an open-ended event (no known end) overlaps on its start
  // alone, the SQL's other branch.
  it('the two-sided rule matches legacy\'s SQL cases', () => {
    const dated = { year_from: 900, year_to: 950 }
    expect(overlapsRange(dated, 940, 960)).toBe(true)
    expect(overlapsRange(dated, 950, 960)).toBe(false) // to_ad(950) not > begin
    expect(overlapsRange(dated, 800, 900)).toBe(false) // from_ad(900) not < end

    const openEnded = { year_from: 1200, year_to: 0 }
    expect(overlapsRange(openEnded, 1000, 1300)).toBe(true)
    expect(overlapsRange(openEnded, 1200, 1300)).toBe(false) // from_ad not > begin
  })

  it('one bound alone', () => {
    expect(overlapsRange({ year_from: 900, year_to: 950 }, 940, null)).toBe(true)
    expect(overlapsRange({ year_from: 900, year_to: 950 }, 950, null)).toBe(false)
    expect(overlapsRange({ year_from: 1200, year_to: 0 }, 1199, null)).toBe(true)
    expect(overlapsRange({ year_from: 900 }, null, 899)).toBe(false)
    expect(overlapsRange({ year_from: 900 }, null, 900)).toBe(true)
  })

  it('no bound at all matches everything, dated or not', () => {
    expect(overlapsRange({ year_from: 900 }, null, null)).toBe(true)
    expect(overlapsRange({ year_from: null }, null, null)).toBe(true)
  })

  it('an undated event never matches a bounded search', () => {
    expect(overlapsRange({ year_from: null }, 1, 2000)).toBe(false)
    expect(overlapsRange({}, 1, null)).toBe(false)
  })
})

describe('touchesRange', () => {
  // Pinned against legacy's `/thg/timeline?na=&nz=` on The Hijaz Railway,
  // whose chronology has 1516–1916, 1918–1920 and 1931–1931.
  it("is inclusive at both ends, as an exhibition's own chronology answered", () => {
    expect(touchesRange({ year_from: 1918, year_to: 1920 }, 1800, 1918)).toBe(true)
    expect(touchesRange({ year_from: 1918, year_to: 1920 }, 1920, 1970)).toBe(true)
    expect(touchesRange({ year_from: 1516, year_to: 1916 }, 1916, 1917)).toBe(true)
    expect(touchesRange({ year_from: 1931, year_to: 1931 }, 1931, 1931)).toBe(true)
    expect(touchesRange({ year_from: 1516, year_to: 1916 }, 1917, 1917)).toBe(false)
    expect(touchesRange({ year_from: 1918, year_to: 1920 }, 1917, 1917)).toBe(false)
  })

  it('takes an event with no known end as its start year, and keeps the bounds optional', () => {
    expect(touchesRange({ year_from: 1400, year_to: 0 }, 1400, 1450)).toBe(true)
    expect(touchesRange({ year_from: 1400 }, 1401, 1450)).toBe(false)
    expect(touchesRange({ year_from: 1400 }, null, 1400)).toBe(true)
    expect(touchesRange({ year_from: null }, null, null)).toBe(true)
    expect(touchesRange({ year_from: null }, 1, 2000)).toBe(false)
  })
})

describe('eventDateLabel', () => {
  it('prefers a date description pair when both name and date_from_description are present', () => {
    expect(
      eventDateLabel({ year_from: 1822 }, { name: 'Champollion', date_from_description: '1822' }, t),
    ).toBe('1822')
  })

  it('uses the name when only name is present, with no date description', () => {
    expect(eventDateLabel({ year_from: 1400 }, { name: 'The earlier chapter' }, t)).toBe('The earlier chapter')
  })

  it('falls back to a curated description pair, or the from-only half of it', () => {
    expect(
      eventDateLabel({ year_from: 1000 }, { date_from_description: 'c. 1000', date_to_description: 'c. 1050' }, t),
    ).toBe('c. 1000 – c. 1050')
    expect(eventDateLabel({ year_from: 1200 }, { date_from_description: 'Early 13th century' }, t))
      .toBe('Early 13th century')
  })

  it('collapses an equal date pair to a single value', () => {
    expect(
      eventDateLabel({ year_from: 1822 }, { date_from_description: '1822', date_to_description: '1822' }, t),
    ).toBe('1822')
    expect(
      eventDateLabel({ year_from: 1822 }, { date_from_description: '1822', date_to_description: ' 1822 ' }, t),
    ).toBe('1822')
  })

  it('derives the label from the year range, through eraLabel, when neither name nor date description is given', () => {
    expect(eventDateLabel({ year_from: 900, year_to: 950 }, {}, t)).toBe('900 AD – 950 AD')
    expect(eventDateLabel({ year_from: 1200, year_to: 0 }, {}, t)).toBe('1200 AD –')
    expect(eventDateLabel({ year_from: -502 }, {}, t)).toBe('502 BC –')
  })

  it('says nothing for an undated event with no text of its own', () => {
    expect(eventDateLabel({ year_from: null }, {}, t)).toBe('')
  })
})

describe('useTimelineEvents', () => {
  describe('scope: country (the worldwide merge)', () => {
    const timeline = useTimelineEvents({ scope: 'country', countryLabel, tr })

    it('lists one entry per country with a chronology, alphabetized, "all" first', () => {
      expect(timeline.countries.value).toEqual([
        { value: 'all', label: null },
        { value: 'c-eg', label: 'Egypt' },
        { value: 'c-sy', label: 'Syria' },
      ])
    })

    it('finds a country\'s events, sorted, with their text', () => {
      const events = timeline.findEvents({ country: 'c-eg' })
      expect(events.map((e) => e.id)).toEqual(['ev1', 'ev2', 'ev4'])
      expect(events[0].text.description).toBe('A dynasty rises in Egypt.')
    })

    it('sorts by year_from then display_order, an undated event after every dated one', () => {
      expect(timeline.findEvents({ country: 'c-sy' }).map((e) => e.id)).toEqual(['ev3', 'ev7'])
    })

    it('"all" and no country at all both mean no country filter', () => {
      const noFilter = timeline.findEvents({}).map((e) => e.id)
      const all = timeline.findEvents({ country: 'all' }).map((e) => e.id)
      expect(noFilter).toEqual(all)
      expect(noFilter).toEqual(expect.arrayContaining(['ev1', 'ev2', 'ev3', 'ev4', 'ev7']))
    })

    it('resolves a code through countryIdForCode when the site passes one', () => {
      const byCode = useTimelineEvents({
        scope: 'country', countryLabel, tr, countryIdForCode: (code) => ({ eg: 'c-eg' })[code] ?? null,
      })
      expect(byCode.findEvents({ country: 'eg' }).map((e) => e.id)).toEqual(['ev1', 'ev2', 'ev4'])
    })

    it('reports the year range over this scope\'s events, excluding the local chronology', () => {
      expect(timeline.yearRange.value).toEqual([900, 1300])
      expect(timeline.yearBuckets(t).length).toBeGreaterThan(0)
    })

    it('has a timeline, and is never the local one', () => {
      expect(timeline.hasTimeline.value).toBe(true)
      expect(timeline.usesLocalTimeline.value).toBe(false)
    })
  })

  describe('scope: local (an exhibition\'s own chronology)', () => {
    const timeline = useTimelineEvents({ scope: 'local', tr })

    it('offers no country picker at all', () => {
      expect(timeline.countries.value).toEqual([])
    })

    it('reports it is showing the local chronology', () => {
      expect(timeline.usesLocalTimeline.value).toBe(true)
      expect(timeline.hasTimeline.value).toBe(true)
    })

    it('finds only the exhibition\'s own events, display_order breaking a tied year', () => {
      const events = timeline.findEvents({})
      expect(events.map((e) => e.id)).toEqual(['ev6', 'ev5'])
      expect(events[0].text.name).toBe('The earlier chapter')
    })

    it('ignores a country filter — there is nothing to filter by', () => {
      expect(timeline.findEvents({ country: 'c-eg' }).map((e) => e.id)).toEqual(['ev6', 'ev5'])
    })
  })

  describe('scope: collection (Sharing History\'s exhibition axis)', () => {
    const timeline = useTimelineEvents({ scope: 'collection', countryLabel, tr })

    it('filters by the exhibition a timeline is bound to', () => {
      expect(timeline.findEvents({ collection: 'exh-1' }).map((e) => e.id)).toEqual(['ev4'])
    })

    it('null is the Permanent Collection sentinel, not "no filter"', () => {
      const permanent = timeline.findEvents({ collection: null }).map((e) => e.id)
      expect(permanent).toEqual(['ev1', 'ev3', 'ev2', 'ev7'])
      expect(permanent).not.toContain('ev4')
    })

    it('combines the collection filter with the country filter', () => {
      expect(timeline.findEvents({ collection: 'exh-1', country: 'c-sy' })).toEqual([])
    })

    it('an unset collection means no filter at all', () => {
      const all = timeline.findEvents({}).map((e) => e.id)
      expect(all).toEqual(expect.arrayContaining(['ev1', 'ev4']))
    })
  })
})
