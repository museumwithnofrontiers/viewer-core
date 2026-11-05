import { computed, toValue } from 'vue'

// One page arithmetic for every list. Five implementations existed — this
// package's own ListView, a block inlined into six standalone views, a
// component copied into four DXA sites, and two idioms for the count — and
// they disagreed on nothing but shape. This is the DXA shape, which answers
// everything a page needs to render itself: where it is, how far it goes,
// and which rows it holds.

const DEFAULT_SIZE = 20

/**
 * `{ total, lastPage, currentPage, from, to, rows }` for one page of `list`.
 * A page past the end clamps to the last one; a page below one is the first;
 * `from`/`to` are 1-based and both 0 for an empty list. The size is the
 * caller's: twenty on the standalone sites and nine on the DXA sites are
 * both legacy facts, and neither is this function's to decide.
 */
export function paginate(list, page, size = DEFAULT_SIZE) {
  const rows = list ?? []
  const total = rows.length
  const perPage = Math.max(1, Number(size) || DEFAULT_SIZE)
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const requested = Number.parseInt(page, 10)
  const currentPage = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), lastPage)
  const start = (currentPage - 1) * perPage
  return {
    total,
    lastPage,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, total),
    rows: rows.slice(start, start + perPage),
  }
}

/**
 * `paginate` over reactive sources: `list` and `page` may each be a ref, a
 * computed, a getter or a plain value — a `useListQuery().page`, typically.
 */
export function usePagination(list, { page = 1, size = DEFAULT_SIZE } = {}) {
  return computed(() => paginate(toValue(list), toValue(page), toValue(size)))
}

/**
 * Chronological order by `key` (a record's `start_date`), undated records
 * last — or first, with `undated: 'first'`. Stable: two records of the same
 * year keep the order they arrived in, or the order `tiebreak(a, b)` gives
 * them (a family's own, e.g. the galleries' `legacyOrder`). Returns a new
 * array.
 */
export function sortChronological(list, { key = 'start_date', undated = 'last', tiebreak = null } = {}) {
  const missing = undated === 'first' ? -Infinity : Infinity
  const year = (record) => {
    const value = record?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : missing
  }
  const byYear = (a, b) => {
    const ya = year(a)
    const yb = year(b)
    return ya === yb ? 0 : ya - yb
  }
  return [...(list ?? [])].sort((a, b) => byYear(a, b) || (tiebreak ? tiebreak(a, b) : 0))
}
