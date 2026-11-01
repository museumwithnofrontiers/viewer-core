import { computed, watch } from 'vue'
import { displayLanguage } from '../displayLanguage.js'
import { useDataPackage } from './useDataPackage.js'
import { byId as coreById, entityRef } from './useEntities.js'
import { md as coreMd, mdInline as coreMdInline, mdStrip as coreMdStrip } from '../i18n/markdown.js'
import { glossaryEntries } from '../record/recordSheet.js'

// The wrapper half of seven sites' data composables (2,376 lines across
// them), written once. Every one of them re-wrapped the same `tr`, the same
// memoised `loadEnglish`, the same one-shape label helper
// (`mdStrip(tr(entity, id).name ?? record.internal_name ?? id)`), and the
// same `md`/`mdInline`/`mdStrip` re-export, around whichever entities and
// visibility rules were its own — a per-build language filter, a hidden-
// partner rule, `display_status` — coded rather than declared. This is that
// wrapper. What survives in a site's own composable is what genuinely
// differs: routes, legacy key mappings, chrome images, sibling lists.
//
// Called once, at the top of a site's data composable module, and its
// return value re-exported from there — the way `entityRef`/`byId` are
// already read at module scope, so importing the module loads nothing and a
// page pays only for the entity it declares. `entity`/`index` read the same
// shared `entityRef`/`byId` this file does, so a second call would only
// duplicate the memoisation `loadEnglish` and the glossary binding carry —
// one instance per site, not one per component.
const BASE_LANGUAGE = 'en'

// A term's spellings and definition in one language, falling back to
// English, then to the term's own headword — the same row shape
// `useRecordSheet`'s `termRow` builds, but for the whole glossary in the
// display language rather than one record's `glossary_ids` in the record's
// own language, which is why it is not reused: a catalogue list is shown in
// the display language, a record sheet in the language the record is read in.
function glossaryRows(language, translations) {
  const rows = translations('glossary', language)
  const fallback = translations('glossary', BASE_LANGUAGE)
  const terms = []
  for (const term of entityRef('glossary').value ?? []) {
    const t = rows[term.id] ?? fallback[term.id] ?? {}
    const spellings = (t.spellings ?? []).map((s) => String(s).trim()).filter(Boolean)
    const word = term.word ?? spellings[0] ?? ''
    if (!word && spellings.length === 0) continue
    terms.push({ id: term.id, word, definition: t.definition ?? '', spellings: spellings.length ? spellings : [word] })
  }
  return terms
}

/**
 * The wrapper half of a website's data composable: `tr`, `md`/`mdInline`/
 * `mdStrip` bound to the site's glossary, `loadEnglish`, `labelOf`, the
 * visible form of an entity and its index, and the package re-exports.
 *
 * `eager` names the entities `loadEnglish` loads — every entity the package
 * carries by default — in `defaultLanguage` and in the display language.
 * `tr`, the labels and the glossary binding read the display language (the
 * language the website is shown in, reference data included: a country is
 * named in the language its record is shown in), and fall back, record by
 * record, to `defaultLanguage` (`'en'` for every site so far). `visible` names,
 * per entity, the predicate `entity()`/`index()` apply — a per-build
 * language filter, a hidden-partner rule, a display-status check are all
 * "which records this build shows", declared here once instead of coded
 * into every page that lists that entity. `glossary` turns off the default
 * binding on `md`/`mdInline` (a caller may still pass its own `glossary` to
 * either, on or off). `followDisplayLanguage: false` keeps everything in
 * `defaultLanguage`, for the DXA families until their pages are checked
 * against legacy in other languages.
 */
export function useCatalogueData({
  eager, defaultLanguage = BASE_LANGUAGE, visible = {}, glossary = true, followDisplayLanguage = true,
} = {}) {
  const pkg = useDataPackage()
  const { availableLanguages, loadTranslations, translations } = pkg
  const eagerEntities = eager ?? pkg.entityNames
  const shown = computed(() => (followDisplayLanguage ? displayLanguage.value : defaultLanguage))

  /** One record's translated fields, in `lang` (the display language), falling back to `defaultLanguage` then `{}`. */
  function tr(entity, id, lang = shown.value) {
    return pkg.tr(entity, id, lang, defaultLanguage)
  }

  /**
   * The language one record is shown in: the display language when the
   * record has text in it, `defaultLanguage` otherwise. The reference names
   * shown next to it (its country, its partner, its dynasties) take this
   * language, so a record left in English is not printed with French names.
   */
  function languageOf(entity, id) {
    const lang = shown.value
    return id && translations(entity, lang)[id] ? lang : defaultLanguage
  }

  const defaultGlossary = computed(() =>
    glossary ? glossaryEntries(glossaryRows(shown.value, translations)) : [],
  )

  // A caller's own `glossary` — a record's own terms, not every term in the
  // package — always wins, whether the default binding is on or off; `md`
  // and `mdInline` differ only in which core renderer they wrap, `mdStrip`
  // has nothing to bind, since plain text carries no highlighting.
  function bindGlossary(renderer) {
    return (text, opts = {}) =>
      renderer(text, { ...opts, glossary: 'glossary' in opts ? opts.glossary : defaultGlossary.value })
  }
  const md = bindGlossary(coreMd)
  const mdInline = bindGlossary(coreMdInline)
  const mdStrip = coreMdStrip

  /**
   * `mdStrip(tr(entity, id, lang).name ?? record[fallback] ?? id)` — the one
   * label shape every site wrote. `lang` is the display language unless the
   * caller names the language of the record the label stands next to.
   */
  function labelOf(entity, id, { fallback = 'internal_name', lang } = {}) {
    if (!id) return ''
    // A label passed as a callback (`.map(countryLabel)`, a facet's
    // `label(value, ctx)`) receives an index or a context here, not a language.
    const name = tr(entity, id, typeof lang === 'string' ? lang : undefined).name
    if (name) return mdStrip(name)
    const record = coreById(entity).value.get(id)
    return mdStrip(record?.[fallback] ?? id)
  }

  let englishReady = null
  /**
   * Loads `defaultLanguage` for every entity in `eager`, once, and the display
   * language too, again each time it changes. Resolves with the
   * `defaultLanguage` files: a page renders in English until the other
   * language arrives, and re-renders then.
   */
  function loadEnglish() {
    if (!englishReady) {
      englishReady = Promise.all(eagerEntities.map((name) => loadTranslations(name, defaultLanguage)))
      watch(shown, (lang) => {
        if (lang !== defaultLanguage) eagerEntities.forEach((name) => loadTranslations(name, lang))
      }, { immediate: true })
    }
    return englishReady
  }

  // Cached the way `byId` is: a site reads `entity('items')`/`index('items')`
  // from more than one place, and each should see the same ref rather than
  // a fresh filter pass and a fresh Map per call.
  const entityCache = new Map()
  /** `entityRef(name)`'s records, narrowed by `visible[name]` when one is declared; `null` until loaded. */
  function entity(name) {
    let ref = entityCache.get(name)
    if (!ref) {
      const source = entityRef(name)
      const predicate = visible[name]
      ref = computed(() => {
        if (source.value === null) return null
        return predicate ? source.value.filter(predicate) : source.value
      })
      entityCache.set(name, ref)
    }
    return ref
  }

  const indexCache = new Map()
  /** A `Map` of `entity(name)`'s records by `key` — the visible ones, unlike `byId`. */
  function index(name, key = 'id') {
    const cacheKey = `${name}.${key}`
    let ref = indexCache.get(cacheKey)
    if (!ref) {
      const list = entity(name)
      ref = computed(() => new Map((list.value ?? []).map((record) => [record[key], record])))
      indexCache.set(cacheKey, ref)
    }
    return ref
  }

  return {
    tr, md, mdInline, mdStrip, loadEnglish, labelOf, languageOf, entity, index,
    availableLanguages, loadTranslations, translations,
  }
}
