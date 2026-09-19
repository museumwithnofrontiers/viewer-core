import { computed } from 'vue'
import { mediaUrl } from '../../siteConfig.js'
import { useCatalogueData } from '../../composables/useCatalogueData.js'
import { useDataPackage } from '../../composables/useDataPackage.js'
import { itemFromUidPath as legacyItemFromUidPath, partnerFromKey as legacyPartnerFromKey } from '../../legacy/index.js'

// The data layer every DXA gallery site (carpets, amulets, …) wrote for
// itself: the entities a gallery reads, the lookup maps over them, its
// routes, its legacy URL mappings and its chrome. Promoted from the
// byte-identical copies the two live galleries carried (epic #1730) — what a
// future gallery needs that is genuinely its own belongs in `config`, not in
// a fork of this file.

/** Every entity a gallery page reads English labels or fallbacks for. */
const DEFAULT_EAGER = ['items', 'partners', 'countries', 'glossary', 'dynasties', 'timeline_events']

/**
 * The gallery's data layer, bound to the installed data package.
 *
 * `config.eager` overrides the entities `loadEnglish` loads eagerly
 * (default: {@link DEFAULT_EAGER}) — a future gallery whose package carries
 * extra entities of its own passes a longer list.
 */
export function useGalleryData(config = {}) {
  const dataPackage = useDataPackage()
  const manifest = dataPackage.manifest

  const catalogue = useCatalogueData({
    eager: config.eager ?? DEFAULT_EAGER,
  })

  const {
    tr, md, mdInline, mdStrip, loadEnglish, labelOf,
    availableLanguages, loadTranslations, translations,
  } = catalogue

  // English is the base language of every catalogue in the platform: every
  // list, label and fallback reads it.
  const defaultLang = 'en'

  // ── Records ────────────────────────────────────────────────────────────
  // Language-independent; every human-readable string lives under translations/.

  const gallery = catalogue.entity('gallery')
  const items = catalogue.entity('items')
  const tags = catalogue.entity('tags')
  const partners = catalogue.entity('partners')
  const countries = catalogue.entity('countries')
  const languages = catalogue.entity('languages')
  const dynasties = catalogue.entity('dynasties')
  const glossary = catalogue.entity('glossary')
  const timelines = catalogue.entity('timelines')
  const timelineEvents = catalogue.entity('timeline_events')

  // ── Lookup maps ────────────────────────────────────────────────────────

  const itemById = catalogue.index('items')
  const partnerById = catalogue.index('partners')
  const countryById = catalogue.index('countries')
  const tagById = catalogue.index('tags')
  const dynastyById = catalogue.index('dynasties')
  const timelineById = catalogue.index('timelines')
  const languageByCode = catalogue.index('languages', 'code')

  // ── Routes ─────────────────────────────────────────────────────────────
  //
  // The canonical routes carry the package id; the language never travels
  // in the path. The legacy shapes (the dbUid path of an item sheet, the
  // country and legacy id of a partner) are redirect-only entries in the
  // site's own `dataset.config.js`, resolved through the two wrappers below.

  function itemRoute(item) {
    return { name: 'item', params: { id: item.id } }
  }

  function partnerRoute(partner) {
    return { name: 'partner', params: { id: partner.id } }
  }

  function partnerObjectsRoute(partner, page = 1) {
    return { name: 'partner-objects', params: { id: partner.id }, query: page > 1 ? { page } : {} }
  }

  // Legacy dbUid ⇄ item, and a partner's country/legacy id ⇄ partner: the
  // `legacy` entry point decodes `backward_compatibility` the way every DXA
  // site does, pure, over plain lists; these two wrappers bind it to this
  // gallery's own `items`/`partners`/`countries` refs, so the site's legacy
  // routes keep calling them with the arguments they already carry.
  function itemFromUidPath(path) {
    return legacyItemFromUidPath(items.value ?? [], path)
  }

  function partnerFromKey(countryCode, legacyId) {
    return legacyPartnerFromKey(partners.value ?? [], countries.value ?? [], countryCode, legacyId)
  }

  // ── Chrome images ──────────────────────────────────────────────────────
  //
  // `image_path`, `banner_image_path` and `homepage_image_path` were never
  // imported into inventory storage: the package ships the legacy path and
  // the address is built from the host the site's `dataset.config.js`
  // declares under `media`.

  function chromeImage(path, size = 'hi_res') {
    return mediaUrl(path, size)
  }

  // ── Sibling galleries ──────────────────────────────────────────────────
  //
  // Decision Q3: these are reference objects, not resolved links. The
  // exporter records identity plus whatever the import carried; where a
  // `legacy_host` came across we can link to it, and where it did not the
  // entry still renders — it just does not become an anchor.

  const siblingGalleries = computed(() =>
    (gallery.value?.sibling_galleries ?? []).filter((g) => !g.hidden),
  )

  function siblingUrl(sibling) {
    return sibling?.legacy_host || null
  }

  /** Four at random, reshuffled per visit. */
  function pickSiblings(count = 4) {
    const pool = [...siblingGalleries.value]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count)
  }

  return {
    manifest,
    defaultLang,
    tr, md, mdInline, mdStrip, loadEnglish, labelOf,
    availableLanguages, loadTranslations, translations,
    gallery, items, tags, partners, countries, languages, dynasties, glossary, timelines, timelineEvents,
    itemById, partnerById, countryById, tagById, dynastyById, timelineById, languageByCode,
    itemRoute, partnerRoute, partnerObjectsRoute, itemFromUidPath, partnerFromKey,
    chromeImage, siblingGalleries, siblingUrl, pickSiblings,
  }
}
