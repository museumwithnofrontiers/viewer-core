import { computed, toValue } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from './i18n/index.js'
import { entityRef } from './composables/useEntities.js'
import { useDataPackage } from './composables/useDataPackage.js'
import { resolveRecordLanguage } from './composables/useRecordLanguage.js'

// Three small conventions each website had written for itself.

// ── Projects, from the data package ─────────────────────────────────────────
//
// `manifest.projects` (epic metanull/inventory-app#1727 — `scripts/exporters`)
// is project data from the data package a project's own exporter writes.
// Its shape, one entry per project UUID:
//
//   manifest.projects[projectId] = {
//     name: { <lang>: '…' },                    // per-language title
//     site_url: 'https://…' | null,
//     related_database_url: 'https://…' | null,
//     artistic_introduction_url: 'https://…' | null,
//   }
//
// A data package built before this phase simply has no `projects` key at
// all; `projectLabel`/`projectLinks` answer `null` for that case exactly as
// they do for an unknown `projectId`. See CHANGELOG.md 2.0.0 for the
// migration notes from this package's former legacy-key conventions.

/** One entry of `manifest.projects`, or `null` when the package predates
 * the section or does not carry `projectId`. */
function projectEntry(manifest, projectId) {
  return manifest?.projects?.[projectId] ?? null
}

/**
 * The name of a project by its data-package UUID, from
 * `manifest.projects[projectId].name`. Language fallback follows the same
 * rule every translated field in this package does (`resolveRecordLanguage`):
 * `lang` when the entry carries it, this package's base language (`en`)
 * when it does not, the first language the entry carries when it has
 * neither. `null` — never a thrown error — when the package has no
 * `projects` section, `projectId` is not one of its keys, or the entry
 * names nothing at all.
 */
export function projectLabel(manifest, projectId, lang) {
  const names = projectEntry(manifest, projectId)?.name
  const codes = names ? Object.keys(names) : []
  if (codes.length === 0) return null
  return names[resolveRecordLanguage(codes, lang)] ?? null
}

/**
 * The three URLs `manifest.projects[projectId]` carries. `null` for the
 * whole result (not per field) when the package predates the section or
 * does not carry `projectId`; each field is `null` on its own when the
 * project simply has no value for it (import time never invents one).
 */
export function projectLinks(manifest, projectId) {
  const entry = projectEntry(manifest, projectId)
  if (!entry) return null
  return {
    siteUrl: entry.site_url ?? null,
    relatedDatabaseUrl: entry.related_database_url ?? null,
    artisticIntroductionUrl: entry.artistic_introduction_url ?? null,
  }
}

/**
 * `projectLabel`/`projectLinks` bound to the installed data package and
 * texts, for a component. `label(projectId)` reads the site's active
 * language; pass a language explicitly to read another.
 */
export function useProjects() {
  const { manifest } = useDataPackage()
  const { locale } = useI18n()
  return {
    label: (projectId, lang = locale.value) => projectLabel(manifest, projectId, lang),
    links: (projectId) => projectLinks(manifest, projectId),
  }
}

// ── The section a route belongs to ─────────────────────────────────────────
//
// A route says what section it is (`meta: { section: 'collection' }`), and
// the shell reads it here for the banner title or the active menu entry.
// Four shells derived the same thing from `route.path.startsWith(…)` chains
// of nine branches each; a route already knows.
export function useSection() {
  const route = useRoute()
  return computed(() => String(route.meta?.section ?? ''))
}

// ── A featured record ──────────────────────────────────────────────────────

// mulberry32 — a small seedable generator, so a test can pin the pick.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One record of `entity` chosen at random for a landing page's spotlight —
 * among those with an image when `withImage` is set (the default), among
 * all when none has one. Null until the entity is loaded. The pick is made
 * once per visit and again only when the records change; `seed` makes it
 * deterministic.
 */
export function useFeaturedRecord(entity, { withImage = true, seed, images = 'images' } = {}) {
  const records = entityRef(entity)
  const random = seed == null ? Math.random : seeded(seed)
  return computed(() => {
    const all = toValue(records) ?? []
    if (all.length === 0) return null
    const pool = withImage ? all.filter((record) => (record?.[images]?.length ?? 0) > 0) : all
    const candidates = pool.length > 0 ? pool : all
    return candidates[Math.floor(random() * candidates.length)] ?? null
  })
}

// ── A route's `meta.entities` ────────────────────────────────────────────

/**
 * `sectionMeta(chrome)` returns a `meta(section, ...entities)` helper: a
 * route's `meta: { section, entities: [...chrome, ...entities] }` in one
 * call. `chrome` is the entities every page of the site loads regardless of
 * what it is (the DXA sites' `['gallery', 'items', 'partners', 'countries']`
 * — the shell reads them on every route); a route names on top of that only
 * the entities its own page adds. Four DXA configs each wrote this same
 * four-line closure next to their own `chrome` list.
 */
export function sectionMeta(chrome = []) {
  return (section, ...entities) => ({ section, entities: [...chrome, ...entities] })
}

// ── The MWNF portal ─────────────────────────────────────────────────────

/**
 * The addresses every DXA `dataset.config.js` repeats under `links` —
 * the portal and the sibling standalone sites a gallery or an exhibition
 * links out to. Frozen: a site's own `links` may add to this object but
 * copying it is what this replaces.
 */
export const mwnfLinks = Object.freeze({
  portal: 'https://www.museumwnf.org',
  galleries: 'https://galleries.museumwnf.org',
  myCollection: 'https://www.museumwnf.org/mycollection/index.php',
  about: 'https://www.museumwnf.org/about',
  contact: 'https://www.museumwnf.org/about/contact',
  legalNotice: 'https://www.museumwnf.org/about/legal-notice',
  credits: 'https://www.museumwnf.org/about/credits',
  cookies: 'https://www.museumwnf.org/about/cookies',
  overallDatabase: 'https://www.museumwnf.org/database_searchform.php',
  islamicArt: 'https://islamicart.museumwnf.org',
  baroqueArt: 'https://baroqueart.museumwnf.org',
  sharingHistory: 'https://sharinghistory.museumwnf.org',
})
