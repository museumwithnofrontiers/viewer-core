import { computed } from 'vue'
import { mediaUrl } from '../../siteConfig.js'
import { useCatalogueData } from '../../composables/useCatalogueData.js'
import { useDataPackage } from '../../composables/useDataPackage.js'
import { byId, entityRef } from '../../composables/useEntities.js'
import { projectLabel } from '../../conventions.js'
import { useLegacyCountryCodes } from '../countryCodes.js'

// The data layer every DXA exhibition site (the-use-of-colours-in-art,
// water-in-islam, …) wrote for itself: the entities an exhibition reads,
// the lookup maps over them, its routes, its legacy key mappings and its
// chrome. Promoted from the byte-identical copies the two live exhibitions
// carried (epic #1730) — what a future exhibition needs that is genuinely
// its own belongs in `config`, not in a fork of this file. The themes tree
// stays in a site's own `composables/themes.js`, on top of viewer-core's
// `useCollectionTree`.

/** Every entity an exhibition page reads English labels or fallbacks for. */
const DEFAULT_EAGER = ['items', 'partners', 'countries', 'glossary', 'dynasties', 'timeline_events', 'themes']

/**
 * The exhibition's data layer, bound to the installed data package. Each
 * entity is a shared ref that stays `null` until a route declaring it in
 * `meta.entities` brings its chunk in, so calling this loads nothing, and a
 * page pays only for what it reads.
 *
 * `config.eager` overrides the entities `loadEnglish` loads eagerly
 * (default: {@link DEFAULT_EAGER}).
 */
export function useExhibitionData(config = {}) {
  const dataPackage = useDataPackage()
  const manifest = dataPackage.manifest

  // English is the base language of every catalogue in the platform: every
  // list, label and fallback reads it. A record the visitor reads in
  // another language is resolved on the sheet itself, by
  // `useRecordLanguage`.
  const defaultLang = 'en'

  const exhibition = entityRef('exhibition')
  const relatedContent = entityRef('related_content')
  const tags = entityRef('tags')
  const countries = entityRef('countries')
  const languages = entityRef('languages')
  const dynasties = entityRef('dynasties')
  const glossary = entityRef('glossary')
  const timelines = entityRef('timelines')
  const timelineEvents = entityRef('timeline_events')

  // E6: a hidden museum is exported but must not appear on any list or
  // profile page. Its items still render — legacy hides the museum, not the
  // object. Declared here as a `visible` predicate rather than coded into
  // every page that lists partners; `isHiddenPartner` stays a named export
  // because the item sheet's holder line is the one surface that needs the
  // opposite of `visible` — the museum keeps its name and loses only the
  // link, because it has no page to link to.
  const hiddenPartnerIds = computed(() => new Set(exhibition.value?.hidden_partner_ids ?? []))
  function isHiddenPartner(partner) {
    return hiddenPartnerIds.value.has(partner?.id)
  }

  const catalogue = useCatalogueData({
    eager: config.eager ?? DEFAULT_EAGER,
    defaultLanguage: defaultLang,
    visible: {
      // An item's `languages` is what it has TRANSLATIONS in, so a
      // non-empty array without this build's language means the text
      // exists in some other language and not in this one — legacy's own
      // instance 404s such a record, and this build drops it to match.
      //
      // An EMPTY array is a different case and must not be swept in with
      // it: it means the package has no text in ANY language, which is a
      // gap in the export rather than a fact about the record, and legacy
      // serves those records regardless. They keep their legacy names
      // through `labelOf`'s `internal_name` fallback and lose only their
      // descriptions. Hence the `!i.languages?.length ||` guard, which
      // reads like a redundant null-check and is not.
      items: (i) => !i.languages?.length || i.languages.includes(defaultLang),
      partners: (p) => !hiddenPartnerIds.value.has(p.id),
    },
  })

  const items = catalogue.entity('items')
  const itemById = catalogue.index('items')
  const visiblePartners = catalogue.entity('partners')
  const visiblePartnerIndex = catalogue.index('partners')
  function visiblePartnerById(id) {
    return visiblePartnerIndex.value.get(id) ?? null
  }

  const {
    tr, md, mdInline, mdStrip, labelOf, loadEnglish, availableLanguages, loadTranslations, translations,
  } = catalogue
  loadEnglish()

  /**
   * Exhibition chrome images and the related-content PDFs.
   * `banner_image_path`, `homepage_image_path` and `document_path` were
   * never imported into inventory storage, so the package ships the legacy
   * path and the address is built from the host the site's
   * `dataset.config.js` declares under `media`. `size` ∈ zoom | hi_res |
   * lo_res | small | full.
   */
  function chromeImage(path, size = 'hi_res') {
    return mediaUrl(path, size)
  }

  // ── Lookup maps ────────────────────────────────────────────────────────
  //
  // Unfiltered, unlike `itemById`/`visiblePartnerById`: a holder line still
  // needs to resolve a hidden museum's name (`isHiddenPartner` above is
  // what suppresses the link), and every other lookup here has no
  // visibility rule to begin with.
  const partnerById = byId('partners')
  const countryById = byId('countries')
  const tagById = byId('tags')
  const dynastyById = byId('dynasties')
  const glossaryById = byId('glossary')
  const languageByCode = byId('languages', 'code')

  // countries.json is keyed by the inventory id (ISO 3166-1 alpha-3), but
  // the legacy two-letter code is what related_content and the timeline
  // keyspaces carry. `code` is the country's own backward_compatibility, so
  // this is the bridge between the two — and the reason it is a lookup
  // rather than a parse is that several legacy codes are not ISO (`uk`,
  // `pa`, `qt`, `ua`, `sb`).
  const countryByCode = computed(
    () => new Map((countries.value ?? []).filter((c) => c.code).map((c) => [c.code, c])),
  )

  /** The same label from a legacy two-letter code (`uk` → United Kingdom). */
  function countryLabelFromCode(code) {
    if (!code) return ''
    const country = countryByCode.value.get(code)
    return country ? labelOf('countries', country.id) : code
  }

  // The legacy code both ways, the one table the collection and the
  // timeline read.
  const { countryIdForCode, countryLabel } = useLegacyCountryCodes({ countries, countryById, timelines, labelOf })

  /** The canonical item route: the package id, and no language in the path. */
  function itemRoute(item) {
    return { name: 'item', params: { id: item.id } }
  }

  // Institutions (monument owners) and museums both live in partners.json —
  // the package ships the union of legacy's /partners and /institutions
  // because a static package has no endpoints to split them across. The
  // viewer routes by `type`, which is what legacy's two page templates
  // keyed off.
  function isInstitution(partner) {
    return partner?.type === 'institution'
  }

  function partnerRoute(partner) {
    return {
      name: isInstitution(partner) ? 'institution' : 'partner',
      params: { id: partner.id },
    }
  }

  function partnerObjectsRoute(partner, page = 1) {
    return {
      name: isInstitution(partner) ? 'institution-monuments' : 'partner-objects',
      params: { id: partner.id },
      query: page > 1 ? { page } : {},
    }
  }

  // ── Source projects ────────────────────────────────────────────────────
  //
  // A member is borrowed from the MWNF project that originally published
  // it. The name is the data package's own `manifest.projects` entry
  // (populated by the importer/exporter), keyed by this record's
  // `project_id` (a UUID) — not a legacy-key lookup, and not an exhibition's
  // own project-key comparisons either. The manifest already names an
  // exhibition's own native project under its own uuid (the sibling
  // `Collection` the importer creates alongside every `Project` carries the
  // same title), so there is no special case here for a native member any
  // more; the colour swatch is this exhibition's own editorial choice
  // (`dataset.config.js`'s `projectColors`, read by the site's `ItemSheet`).

  // Some members have no `project_id` at all: they come from the Explore
  // monuments database rather than from a project, which is why provenance
  // has to be read from the keyspace here instead of from a field. Legacy
  // still coloured them and still printed an empty project name, so its
  // citation read `"…" in , Museum With No Frontiers, …` with a hole in it.
  // The colour is reproduced (the site's own `.mwnf-chip--Explore` rule);
  // the empty name is not, because a label reading "for" with nothing after
  // it is a rendering fault rather than a faithful copy. The line is
  // dropped instead.
  function isExploreRecord(item) {
    return (item?.backward_compatibility ?? '').startsWith('mwnf3_explore:')
  }

  /** `null` for a record with no project (the Explore case) or whose
   * project the manifest does not name in `lang`. */
  function projectName(item, lang = defaultLang) {
    return projectLabel(manifest, item?.project_id, lang)
  }

  /** The exhibition's own per-language chrome text. */
  function exhibitionTitle(lang = defaultLang) {
    return exhibition.value?.titles?.[lang] ?? exhibition.value?.titles?.en ?? ''
  }

  function exhibitionSubtitle(lang = defaultLang) {
    return exhibition.value?.subtitles?.[lang] ?? exhibition.value?.subtitles?.en ?? ''
  }

  function exhibitionHeadline(lang = defaultLang) {
    return exhibition.value?.headlines?.[lang] ?? exhibition.value?.headlines?.en ?? ''
  }

  function bannerCaption(lang = defaultLang) {
    return exhibition.value?.banner_captions?.[lang] ?? exhibition.value?.banner_captions?.en ?? ''
  }

  // ── Sibling sites ──────────────────────────────────────────────────────
  //
  // Decision Q3: these are reference objects, not resolved links. The
  // exporter records identity plus whatever the import carried; where a
  // `legacy_host` came across we can link to it, and where it did not the
  // entry still renders — it just does not become an anchor.

  const siblingSites = computed(
    () => (exhibition.value?.sibling_sites ?? []).filter((s) => !s.hidden),
  )

  function siblingUrl(sibling) {
    return sibling?.legacy_host || null
  }

  return {
    manifest,
    defaultLang,
    exhibition, relatedContent, tags, countries, languages, dynasties, glossary, timelines, timelineEvents,
    isHiddenPartner,
    items, itemById, visiblePartners, visiblePartnerById,
    tr, md, mdInline, mdStrip, labelOf, loadEnglish, availableLanguages, loadTranslations, translations,
    chromeImage,
    partnerById, countryById, tagById, dynastyById, glossaryById, languageByCode,
    countryByCode, countryLabelFromCode, countryIdForCode, countryLabel,
    itemRoute, isInstitution, partnerRoute, partnerObjectsRoute,
    isExploreRecord, projectName,
    exhibitionTitle, exhibitionSubtitle, exhibitionHeadline, bannerCaption,
    siblingSites, siblingUrl,
  }
}
