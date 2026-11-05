import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { paginate, sortChronological, usePagination } from '../src/index.js'

const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }))

describe('paginate', () => {
  it('answers where a page is and what it holds', () => {
    const page = paginate(rows, 2, 10)
    expect(page).toMatchObject({ total: 23, lastPage: 3, currentPage: 2, from: 11, to: 20 })
    expect(page.rows.map((r) => r.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  })

  it('clamps a page past the end and one below the first', () => {
    expect(paginate(rows, 9, 10)).toMatchObject({ currentPage: 3, from: 21, to: 23 })
    expect(paginate(rows, 0, 10).currentPage).toBe(1)
    expect(paginate(rows, 'x', 10).currentPage).toBe(1)
  })

  it('is defined for nothing', () => {
    expect(paginate([], 1, 10)).toEqual({ total: 0, lastPage: 1, currentPage: 1, from: 0, to: 0, rows: [] })
    expect(paginate(null, 1).total).toBe(0)
  })

  it('leaves the page size to the caller, twenty by default', () => {
    expect(paginate(rows, 1).rows).toHaveLength(20)
    expect(paginate(rows, 1, 9).rows).toHaveLength(9)
  })
})

describe('usePagination', () => {
  it('follows its reactive sources', () => {
    const list = ref(rows)
    const page = ref(1)
    const paged = usePagination(list, { page, size: 10 })
    expect(paged.value.currentPage).toBe(1)
    page.value = 3
    expect(paged.value.rows.map((r) => r.id)).toEqual([21, 22, 23])
    list.value = rows.slice(0, 5)
    expect(paged.value).toMatchObject({ currentPage: 1, lastPage: 1, total: 5 })
  })
})

describe('sortChronological tiebreak', () => {
  it('orders two records of the same year by the tiebreak, the years first', () => {
    const list = [{ id: 'k12', start_date: 1000 }, { id: 'k4', start_date: 1000 }, { id: 'early', start_date: 950 }, { id: 'none' }]
    const byNumber = (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))
    expect(sortChronological(list, { undated: 'first', tiebreak: byNumber }).map((r) => r.id)).toEqual(['none', 'early', 'k4', 'k12'])
    // Without one, arrival order.
    expect(sortChronological(list, { undated: 'first' }).map((r) => r.id)).toEqual(['none', 'early', 'k12', 'k4'])
  })
})

describe('sortChronological', () => {
  const items = [
    { id: 'b', start_date: 1200 },
    { id: 'undated' },
    { id: 'a', start_date: 900 },
    { id: 'c', start_date: 1200 },
  ]

  it('orders by start date, undated last, keeping ties in order', () => {
    expect(sortChronological(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'undated'])
  })

  it('can put the undated first, and reads another key', () => {
    expect(sortChronological(items, { undated: 'first' })[0].id).toBe('undated')
    expect(sortChronological([{ y: 2 }, { y: 1 }], { key: 'y' })[0].y).toBe(1)
  })

  it('returns a new array', () => {
    expect(sortChronological(items)).not.toBe(items)
  })
})
