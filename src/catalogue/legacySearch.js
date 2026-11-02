import { ref } from 'vue'
import { useDataPackage } from '../composables/useDataPackage.js'
import { entityRef, loadEntities } from '../composables/useEntities.js'
import { searchRows, SEARCH_LANGUAGE_KEY } from './fieldSearch.js'

// The standalone sites' Database search as legacy ran it
// (`database_results.php`, Decision D3): up to four keyword rows joined by
// AND/OR, each a substring of what its field searches, read the way the
// tables' collation compared text. With no search language, a record
// matches through any one of its translations, all rows within that same
// translation, as legacy's one row per language did. A word that names a
// country also finds that country's records, in the fields that said so; a
// word that is a glossary term also searches the term's spellings in the
// language the site is read in. Matches come most relevant first, then by
// start date.

// A Latin letter without its accents; any other character as it is, since
// the collation weighed the marks of other scripts (an Arabic vowel sign, a
// hamza) as characters of their own.
const latinBase = new Map()
function baseOf(char) {
  let base = latinBase.get(char)
  if (base === undefined) {
    const bare = char.normalize('NFD').replace(/\p{M}/gu, '')
    base = bare && bare.codePointAt(0) < 0x250 ? bare : char
    latinBase.set(char, base)
  }
  return base
}

/**
 * Text as MySQL's `utf8_general_ci` compared it: no case, no accents on a
 * Latin letter, and Turkish dotless ı as i.
 */
export function collate(value) {
  const text = String(value ?? '').normalize('NFC')
  if (/^[\x00-\x7f]*$/.test(text)) return text.toLowerCase()
  let out = ''
  for (const char of text) out += baseOf(char)
  return out.toLowerCase().replace(/ı/g, 'i')
}

function strings(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.flatMap(strings)
  return [String(value)]
}

// Legacy ordered by `LPAD(start_date, 5, '0')`: a record with no start date
// first, then the dates up.
function byStartDate(a, b) {
  const da = a.record.start_date
  const db = b.record.start_date
  if (da == null || db == null) return (da == null ? 0 : 1) - (db == null ? 0 : 1)
  return Number(da) - Number(db)
}

/**
 * `fields`: `{ [field]: (record, text, language) => string | string[] }`,
 * what each field of the form searches in a record and one of its
 * translations, given that translation's language (so a field can read a
 * related record's text in the same language, as legacy's joins did).
 * `countryFields`: the fields in which a word naming a country (in any of
 * its names) also finds the records of that country.
 * `glossaryFields`: the fields in which a glossary term also searches its
 * spellings in the site's language.
 * `score`: `{ [field]: (like, record, text, inCountry, language) => number }`,
 * the relevance a matching row adds, `like(value)` telling whether a value
 * holds the row's own word. Summed over the rows, the best translation
 * counting.
 *
 * Returns `narrow(list, filters, helpers)` for a results spec (pass it
 * `sort: false`): the records of `list` that match, in legacy's order.
 * `helpers.locale` is the language the site is read in. `prepare()` loads
 * every translation the search reads and sets `ready`, so a page can wait
 * for it rather than show a count that grows as the languages arrive.
 */
export function useLegacySearch({
  fields,
  entity = 'items',
  countryFields = [],
  glossaryFields = [],
  score = {},
  rows = 4,
  countries = 'countries',
  glossary = 'glossary',
} = {}) {
  const pkg = useDataPackage()
  const requested = new Set()
  // What a field searches in one translation, folded once: keyed on the
  // translation object, so a file loaded again starts afresh.
  const folded = new WeakMap()

  function hayOf(field, record, text, language) {
    let byField = folded.get(text)
    if (!byField) folded.set(text, (byField = new Map()))
    let hay = byField.get(field)
    if (!hay) {
      const getter = fields[field] ?? fields.keyword
      byField.set(field, (hay = strings(getter(record, text, language)).map(collate)))
    }
    return hay
  }

  function load(name, languages) {
    for (const language of languages) {
      const key = `${name}.${language}`
      if (requested.has(key)) continue
      requested.add(key)
      pkg.loadTranslations(name, language)
    }
  }

  function countryIds(needle) {
    load(countries, pkg.availableLanguages(countries))
    const ids = new Set()
    for (const record of entityRef(countries).value ?? []) {
      const names = [record.internal_name, ...pkg.availableLanguages(countries)
        .map((language) => pkg.translations(countries, language)[record.id]?.name)]
      if (names.some((name) => name && collate(name).includes(needle))) ids.add(record.id)
    }
    return ids
  }

  function spellings(needle, language) {
    const languages = pkg.availableLanguages(glossary)
    load(glossary, languages)
    const out = []
    for (const record of entityRef(glossary).value ?? []) {
      const every = [record.word, ...languages.flatMap((l) => pkg.translations(glossary, l)[record.id]?.spellings ?? [])]
      if (every.some((s) => s && collate(s) === needle)) {
        out.push(...(pkg.translations(glossary, language)[record.id]?.spellings ?? []).map(collate))
      }
    }
    return out
  }

  function narrow(list, filters, helpers = {}) {
    loadEntities([countries, glossary].filter((name) => pkg.entityNames.includes(name)))
    const searchLanguage = filters[SEARCH_LANGUAGE_KEY] || ''
    const languages = searchLanguage ? [searchLanguage] : pkg.availableLanguages(entity)
    load(entity, languages)
    const site = helpers.locale?.value ?? helpers.locale ?? 'en'

    const active = searchRows(filters, rows)
      .filter((row) => String(row.keyword ?? '').trim() !== '')
      .map((row) => {
        const needle = collate(String(row.keyword).trim())
        return {
          ...row,
          needle,
          needles: [needle, ...(glossaryFields.includes(row.field) ? spellings(needle, site) : [])].filter(Boolean),
          countries: countryFields.includes(row.field) ? countryIds(needle) : new Set(),
        }
      })

    const matched = []
    for (const record of list ?? []) {
      let best = null
      for (const language of languages) {
        const text = pkg.translations(entity, language)[record.id]
        if (!text) continue
        let result = null
        let relevance = 0
        for (const row of active) {
          const inCountry = row.countries.has(record.country_id)
          const hay = hayOf(row.field, record, text, language)
          const hit = inCountry || hay.some((h) => row.needles.some((n) => h.includes(n)))
          if (result === null) result = hit
          else if (String(row.cond).toUpperCase() === 'OR') result = result || hit
          else result = result && hit
          const rank = score[row.field]
          if (rank) relevance += rank((value) => strings(value).some((v) => collate(v).includes(row.needle)), record, text, inCountry, language)
        }
        if (result === null || result) best = Math.max(best ?? 0, relevance)
      }
      if (best !== null) matched.push({ record, relevance: best })
    }
    matched.sort((a, b) => b.relevance - a.relevance || byStartDate(a, b))
    return matched.map((m) => m.record)
  }

  const ready = ref(false)
  let preparing = null
  function prepare() {
    preparing ??= (async () => {
      const lookups = [countries, glossary].filter((name) => pkg.entityNames.includes(name))
      await loadEntities(lookups)
      await Promise.all([entity, ...lookups].flatMap((name) => pkg.availableLanguages(name).map((language) => {
        requested.add(`${name}.${language}`)
        return pkg.loadTranslations(name, language)
      })))
      ready.value = true
    })()
    return preparing
  }

  return { narrow, prepare, ready }
}
