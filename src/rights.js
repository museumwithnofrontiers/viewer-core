import { useRouter } from 'vue-router'
import { mwnfLinks } from './conventions.js'
import { useDataPackage } from './composables/useDataPackage.js'
import { useSiteConfig } from './siteConfig.js'

// A site's rights and the address of one of its pages — two facts a
// citation needs that neither `citation()` nor the data package can know by
// itself. The rights holder and terms come from the exporter's
// `manifest.json` (inventory-app#1690 puts a `rights` block there); a
// page's own address depends on where the site is deployed, which the
// package cannot declare either. Both are read from one place a website
// declares once — the manifest's `rights` block, and `site.origin` in
// `dataset.config.js` — so a composed view asks here instead of assembling
// its own guess.

/**
 * `{ holder, termsUrl, attribution }` from the loaded data package's
 * `manifest.rights`. A package built before the block existed, or one that
 * carries none, has no holder or attribution to offer, and its terms
 * address falls back to the MWNF legal notice — the address every site
 * pointed at before a package could declare its own.
 */
export function useSiteRights() {
  const { manifest } = useDataPackage()
  const rights = manifest.rights
  return {
    holder: rights?.rights_holder ?? null,
    termsUrl: rights?.terms_url ?? mwnfLinks.legalNotice,
    attribution: rights?.attribution ?? null,
  }
}

// The declared origin without the trailing slashes a site may have put on it
// (a loop, not a regular expression: an origin is the site's own input).
function siteOrigin() {
  let origin = String(useSiteConfig().site?.origin ?? '')
  while (origin.endsWith('/')) origin = origin.slice(0, -1)
  return origin
}

/**
 * The address of `route` on this deployment: the declared `site.origin`
 * plus the hash the router would put in the location bar for it. Null when
 * the site declares no origin, so a page renders its citation without a
 * source address instead of one that resolves nowhere once copied out of
 * the app. `route` is either a route already resolved (its `fullPath` read
 * directly, so asking for the current page's own address costs no second
 * resolution) or a raw location, which the installed router resolves the
 * same way a `<router-link>` would.
 */
export function sourceUrl(route) {
  const origin = siteOrigin()
  if (!origin) return null
  const fullPath =
    typeof route === 'object' && route !== null && typeof route.fullPath === 'string'
      ? route.fullPath
      : useRouter().resolve(route).fullPath
  return `${origin}/#${fullPath}`
}

/**
 * The address of `path` (a router path, e.g. `/item/<id>`) on the sibling
 * site `slug`: every site is deployed beside the others, one path segment
 * under a common parent, so a sibling's origin is this site's with its last
 * segment swapped. Null when the site declares no origin, or no slug is given.
 */
export function siblingSiteUrl(slug, path) {
  const origin = siteOrigin()
  if (!origin || !slug) return null
  const parent = origin.slice(0, origin.lastIndexOf('/'))
  return `${parent}/${slug}/#${path}`
}
