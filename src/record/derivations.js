import { computed, ref, toValue } from 'vue'
import { useDataPackage } from '../composables/useDataPackage.js'
import { byId, entityRef } from '../composables/useEntities.js'
import { renderPlain } from '../i18n/markdown.js'
import { roundOutward } from '../catalogue/dates.js'

const BASE_LANGUAGE = 'en'

// Four derivations every record page makes, written seven times.

// ── The glossary popup ─────────────────────────────────────────────────────
//
// The renderer marks every glossary spelling as
// `<span class="gloss-term" data-gid="…">` while it parses. Those spans are
// inside `v-html`, so nothing binds to them one by one: one listener on the
// container reads the click and answers with the term.

/**
 * `{ active, onClick, close }`: attach `onClick` to the element the sheet
 * renders into; `active` is `{ id, word, spelling, definition }` for the
 * term clicked, null otherwise. `entries` is the `glossary` list of
 * `useRecordSheet` (a ref, getter or array).
 */
export function useGlossaryPopup(entries) {
  const active = ref(null)
  function onClick(event) {
    const element = event?.target?.closest?.('.gloss-term')
    if (!element) return
    event.preventDefault()
    const id = element.dataset.gid
    const entry = (toValue(entries) ?? []).find((e) => e.id === id)
    active.value = {
      id,
      spelling: element.textContent,
      word: entry?.word ?? element.textContent,
      definition: entry?.definition ?? '',
    }
  }
  function close() {
    active.value = null
  }
  return { active, onClick, close }
}

/**
 * The glossary terms whose spelling starts with `input`, among those that have
 * a row in `language` (legacy searched that language's glossary only), for a
 * glossary search box: `[{ id, word,
 * spelling, definition }]`, one per term, sorted by spelling.
 */
export function searchGlossary(input, language, { entity = 'glossary' } = {}) {
  const needle = String(input ?? '').trim().toLowerCase()
  if (!needle) return []
  const { translations } = useDataPackage()
  const rows = translations(entity, language)
  const out = []
  for (const term of entityRef(entity).value ?? []) {
    const t = rows[term.id]
    if (!t) continue
    const spellings = t.spellings?.length ? t.spellings : [term.word]
    for (const spelling of spellings) {
      if (String(spelling ?? '').toLowerCase().startsWith(needle)) {
        out.push({ id: term.id, word: term.word, spelling: String(spelling).trim(), definition: t.definition ?? '' })
        break
      }
    }
  }
  return out.sort((a, b) => a.spelling.localeCompare(b.spelling))
}

// ── Citation ───────────────────────────────────────────────────────────────

/**
 * The sentence both families print under a sheet:
 * `Author "Name" in Project, Publisher, Year. Permalink` — assembled here in
 * that order, from parts, rather than written into a text with holes in it.
 * `inWord` is the site's `t('record.citation.in')`. Parts that are missing
 * are left out with their punctuation.
 */
export function citation({ author, name, project, publisher = 'Museum With No Frontiers', year, permalink, inWord = 'in' } = {}) {
  const title = renderPlain(name ?? '')
  if (!title) return ''
  const when = year ?? new Date().getFullYear()
  const where = [project, publisher].filter(Boolean).join(', ')
  const parts = []
  if (author) parts.push(String(author).trim())
  parts.push(`"${title}"`)
  if (where) parts.push(`${inWord} ${where},`)
  let sentence = `${parts.join(' ')} ${when}.`
  if (permalink) sentence += ` ${permalink}`
  return sentence
}

// ── Related records ────────────────────────────────────────────────────────

/**
 * A record's `related_items`, split by whether the package carries them:
 * `inPackage` is `[{ reference, record, justification }]` with the
 * justification in `language` only, as legacy printed it; `outside` is the
 * references the package does not hold, kept as the references they are — a
 * link is never dropped for being unresolvable, and never invented either.
 */
export function relatedRecords(record, { entity = 'items', language = BASE_LANGUAGE, field = 'related_items' } = {}) {
  const index = byId(entity).value
  const inPackage = []
  const outside = []
  const seen = new Set()
  for (const reference of record?.[field] ?? []) {
    if (!reference || seen.has(reference.id)) continue
    seen.add(reference.id)
    const found = reference.in_package === false ? null : index.get(reference.id)
    if (!found) {
      outside.push(reference)
      continue
    }
    const justifications = reference.justifications ?? {}
    inPackage.push({
      reference,
      record: found,
      justification: justifications[language] ?? '',
    })
  }
  return { inPackage, outside }
}

/** `relatedRecords` over reactive sources. */
export function useRelatedRecords(record, options = {}) {
  return computed(() => relatedRecords(toValue(record), { ...options, language: toValue(options.language) ?? BASE_LANGUAGE }))
}

// ── The timeline link ──────────────────────────────────────────────────────

/**
 * The route location of the timeline results for a record's country and
 * dates, or null when the record has neither a country nor a date. `name`
 * is the site's timeline-results route; `keys` the query keys it reads
 * (`country`, `begin`, `end` by default); `country(record)` the value the
 * route wants for the country (the id by default — a site whose timeline
 * reads legacy codes passes its own); `round` rounds the dates outward to
 * the century, as the DXA "Timeline for this item" does.
 */
export function timelineLinkFor(record, { name = 'timeline-results', keys = {}, country, round = false } = {}) {
  if (!record) return null
  const countryValue = country ? country(record) : record.country_id
  const start = typeof record.start_date === 'number' ? record.start_date : null
  const end = typeof record.end_date === 'number' ? record.end_date : null
  if (!countryValue && start == null && end == null) return null
  let [from, to] = [start, end]
  if (round) [from, to] = roundOutward(start ?? undefined, end ?? undefined)
  const query = {}
  if (countryValue) query[keys.country ?? 'country'] = String(countryValue)
  if (from != null) query[keys.begin ?? 'begin'] = String(from)
  if (to != null) query[keys.end ?? 'end'] = String(to)
  return { name, query }
}

// ── Legacy's sheet lines ───────────────────────────────────────────────────
//
// How legacy's sheets printed a value, written once so each website prints
// it the way its own legacy did.

/**
 * `text` without the period(s) that end it, as legacy's `removeEndingPoint`
 * printed most sheet values — sparing a period after "C", as in "B.C.".
 * Anything but a string comes back as ''.
 *
 * Legacy's `preg_replace("/([^C])\.+[[:space:]]*$/", "\\1", …)`, read as a
 * scan from the end rather than as that regex, which backtracks
 * polynomially on a long run of periods. Same answers: the final run of
 * periods goes with the whitespace after it; after a "C", or at the very
 * start, the run's first period stays.
 */
export function removeEndingPoint(text) {
  if (typeof text !== 'string') return ''
  const body = text.trimEnd()
  let start = body.length
  while (start > 0 && body[start - 1] === '.') start--
  if (start === body.length) return text
  if (start === 0 || body[start - 1] === 'C') return body.length - start > 1 ? body.slice(0, start + 1) : text
  return body.slice(0, start)
}

/**
 * A picture's photographer and copyright in `language`. Legacy kept them per
 * language, like the caption, and printed only the page language's. A package
 * exported before the per-language `photographers` and `copyrights` maps
 * existed has only the flat fields, which it reads instead.
 */
export function pictureCredits(picture, language) {
  if (picture?.photographers || picture?.copyrights) {
    return { photographer: picture.photographers?.[language] ?? '', copyright: picture.copyrights?.[language] ?? '' }
  }
  return { photographer: picture?.photographer ?? '', copyright: picture?.copyright ?? '' }
}

/**
 * The pictures a page in `language` shows. Legacy listed a picture on a page
 * only where it had a row in that language, empty or not; a package carries
 * those languages per picture (`languages`). A package exported before them
 * has no such list, and every picture shows, as before.
 */
export function picturesInLanguage(pictures, language) {
  return (pictures ?? []).filter((picture) => !Array.isArray(picture?.languages) || picture.languages.includes(language))
}

/**
 * A credit line from its people (`credit_names[role]` in a package): each one
 * as the galleries' sheet printed them, "Firstname LASTNAME" (dxa-api's SQL
 * capitalised the surname; the data keeps it as written), or as written when
 * the entry is a spelling of its own (`{ name }`: the original script on an
 * Arabic page, or the record's own credit column). Joined with ", ".
 */
export function creditLine(names) {
  return (names ?? [])
    .map((entry) => {
      if (typeof entry?.name === 'string') return entry.name.trim()
      return [entry?.firstname?.trim(), entry?.lastname?.trim()?.toLocaleUpperCase()].filter(Boolean).join(' ')
    })
    .filter(Boolean)
    .join(', ')
}

const lifePart = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * The artist the sheet names: the translation's own `artist`. Legacy wrote the
 * artist line per language ("Unknown", "Inconnu", or a sentence in Arabic) and
 * printed a language's own line, or nothing when that language had none, so
 * the package carries it on each translation (inventory-app#2233). The
 * record's `artist_names` come from one language's line and stand for none;
 * the record stays a parameter so callers need not change.
 */
// eslint-disable-next-line no-unused-vars
export function recordArtist(record, text) {
  return lifePart(text?.artist)
}

/**
 * The artist line as Markdown: `artist`, then the artist's life data the
 * record's translation carries (`artist_birthdate`, `artist_birthplace`,
 * `artist_deathdate`, `artist_deathplace`), each part only when set and
 * joined exactly as legacy joined it, in one of legacy's two shapes:
 *
 * - `'bracketed'` — Baroque Art's and Sharing History's `database_item.php`:
 *   on the artist's line, after a no-break space,
 *   `Name (1660, Chemnitz-1736, Augsburg)`; a missing birth date keeps the
 *   comma before the place, as it did there. Nothing without an artist.
 * - `'line'` — the galleries' and exhibitions' `DatabaseItem.vue`
 *   (`returnArtistData`): on a line of its own under the artist,
 *   `1660, Chemnitz - 1736, Augsburg`.
 *
 * Islamic Art's sheet printed the artist alone. '' when there is nothing
 * to print.
 */
export function artistLine(artist, text, { style = 'bracketed' } = {}) {
  const name = lifePart(artist)
  const born = lifePart(text?.artist_birthdate)
  const bornAt = lifePart(text?.artist_birthplace)
  const died = lifePart(text?.artist_deathdate)
  const diedAt = lifePart(text?.artist_deathplace)
  if (style === 'line') {
    const birth = [born, bornAt].filter(Boolean).join(', ')
    const death = [died, diedAt].filter(Boolean).join(', ')
    return [name, [birth, death].filter(Boolean).join(' - ')].filter(Boolean).join('  \n')
  }
  if (!name) return ''
  if (!(born || bornAt || died || diedAt)) return name
  return `${name} (${born}${bornAt ? `, ${bornAt}` : ''}${died ? `-${died}` : ''}${diedAt ? `, ${diedAt}` : ''})`
}
