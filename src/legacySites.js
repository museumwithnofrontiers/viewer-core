import { siblingSiteUrl } from './rights.js'

// Links to legacy MWNF sites that have a new one (inventory-app#2482). The
// legacy sites linked to each other by address, and those addresses are in
// the texts a site shows (its package's, its locales', extracted from legacy
// as they were written) and in its configuration. A link to a legacy site
// that has a new site goes to the new one; the texts themselves stay as
// imported, and a link with no new site behind it stays as it is.
//
// The estate's legacy addresses, one row a site: a gallery, Explore, the
// galleries hub and the three products by host; an exhibition by host and
// its first path segment (they share a host); a mini-site by its own page
// (a Sharing History one by its `eId`). Built from the parity tool's sitemap
// (the legacy dumps) and the exporters' instance files; the parity `links`
// pass fails on a link this table misses.
export const LEGACY_SITES = [
  { host: 'amulets.museumwnf.org', slug: 'amulets', family: 'gallery' },
  { host: 'archaeology.museumwnf.org', slug: 'archaeology', family: 'gallery' },
  { host: 'architectural-elements.museumwnf.org', slug: 'architectural-elements', family: 'gallery' },
  { host: 'arms-armoury.museumwnf.org', slug: 'arms-armoury', family: 'gallery' },
  { host: 'exhibitions.museumwnf.org', path: '/arts_in_dialogue/', slug: 'arts-in-dialogue', family: 'exhibition' },
  { host: 'baroqueart.museumwnf.org', slug: 'baroqueart', family: 'baroqueart' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/absolutism/', slug: 'baroqueart-absolutism', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/bourgeoisie/', slug: 'baroqueart-bourgeoisie', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/devotion/', slug: 'baroqueart-devotion', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/enlightenment/', slug: 'baroqueart-enlightenment', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/ephemera/', slug: 'baroqueart-ephemera', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/languages_baroque/', slug: 'baroqueart-languages-baroque', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/reformation/', slug: 'baroqueart-reformation', family: 'minisite' },
  { host: 'baroqueart.museumwnf.org', path: '/exhibitions/bar/travelling_and_exotism/', slug: 'baroqueart-travelling-and-exotism', family: 'minisite' },
  { host: 'calligraphy.museumwnf.org', slug: 'calligraphy', family: 'gallery' },
  { host: 'carpets.museumwnf.org', slug: 'carpets', family: 'gallery' },
  { host: 'ceramics.museumwnf.org', slug: 'ceramics', family: 'gallery' },
  { host: 'clothing.museumwnf.org', slug: 'clothing', family: 'gallery' },
  { host: 'coins-medals.museumwnf.org', slug: 'coins-medals', family: 'gallery' },
  { host: 'communication.museumwnf.org', slug: 'communication', family: 'gallery' },
  { host: 'explore.museumwnf.org', slug: 'explore', family: 'explore' },
  { host: 'funerary-objects.museumwnf.org', slug: 'funerary-objects', family: 'gallery' },
  { host: 'galleries.museumwnf.org', slug: 'galleries', family: 'galleries' },
  { host: 'glass.museumwnf.org', slug: 'glass', family: 'gallery' },
  { host: 'gold-silver.museumwnf.org', slug: 'gold-silver', family: 'gallery' },
  { host: 'cars.museumwnf.org', slug: 'historical-cars', family: 'gallery' },
  { host: 'islamicart.museumwnf.org', slug: 'islamicart', family: 'islamicart' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/arabic_calligraphy/', slug: 'islamicart-arabic-calligraphy', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/gai/isl/', slug: 'islamicart-artistic-introduction', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/crusader/', slug: 'islamicart-crusader', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/fatimids/', slug: 'islamicart-fatimids', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/figural/', slug: 'islamicart-figural', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/floral/', slug: 'islamicart-floral', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/geometric/', slug: 'islamicart-geometric', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/mudejar_art/', slug: 'islamicart-mudejar-art', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/muslim_west/', slug: 'islamicart-muslim-west', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/pilgrimage/', slug: 'islamicart-pilgrimage', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/siculo_norman/', slug: 'islamicart-siculo-norman', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/the_abbasids/', slug: 'islamicart-the-abbasids', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/the_ayyubids/', slug: 'islamicart-the-ayyubids', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/the_mamluks/', slug: 'islamicart-the-mamluks', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/the_ottomans/', slug: 'islamicart-the-ottomans', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/the_umayyads/', slug: 'islamicart-the-umayyads', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/water/', slug: 'islamicart-water', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/western_influence/', slug: 'islamicart-western-influence', family: 'minisite' },
  { host: 'islamicart.museumwnf.org', path: '/exhibitions/isl/women/', slug: 'islamicart-women', family: 'minisite' },
  { host: 'ivory.museumwnf.org', slug: 'ivory', family: 'gallery' },
  { host: 'jewellery.museumwnf.org', slug: 'jewellery', family: 'gallery' },
  { host: 'landscapes.museumwnf.org', slug: 'landscapes', family: 'gallery' },
  { host: 'leatherworks.museumwnf.org', slug: 'leatherworks', family: 'gallery' },
  { host: 'manuscripts.museumwnf.org', slug: 'manuscripts', family: 'gallery' },
  { host: 'metalwork.museumwnf.org', slug: 'metalwork', family: 'gallery' },
  { host: 'mosaics.museumwnf.org', slug: 'mosaics', family: 'gallery' },
  { host: 'musical-instruments.museumwnf.org', slug: 'musical-instruments', family: 'gallery' },
  { host: 'paintings.museumwnf.org', slug: 'paintings', family: 'gallery' },
  { host: 'photographs.museumwnf.org', slug: 'photographs', family: 'gallery' },
  { host: 'porcelain.museumwnf.org', slug: 'porcelain', family: 'gallery' },
  { host: 'portraits.museumwnf.org', slug: 'portraits', family: 'gallery' },
  { host: 'precious-stones.museumwnf.org', slug: 'precious-stones', family: 'gallery' },
  { host: 'prints-drawings.museumwnf.org', slug: 'prints-drawings', family: 'gallery' },
  { host: 'religious-life.museumwnf.org', slug: 'religious-life', family: 'gallery' },
  { host: 'scientific-objects.museumwnf.org', slug: 'scientific-objects', family: 'gallery' },
  { host: 'sculptures.museumwnf.org', slug: 'sculptures', family: 'gallery' },
  { host: 'sharinghistory.museumwnf.org', slug: 'sharinghistory', family: 'sharinghistory' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '3' }, slug: 'sharinghistory-cities-and-urban-spaces', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '6' }, slug: 'sharinghistory-economy-and-trade', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '5' }, slug: 'sharinghistory-fine-and-applied-arts', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '4' }, slug: 'sharinghistory-great-inventions-of-the-19th-century', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '7' }, slug: 'sharinghistory-international-exhibitions', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '8' }, slug: 'sharinghistory-migrations', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '9' }, slug: 'sharinghistory-music-literature-dance-and-fashion', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '1' }, slug: 'sharinghistory-rediscovering-the-past', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '10' }, slug: 'sharinghistory-reforms-and-social-changes', family: 'minisite' },
  { host: 'sharinghistory.museumwnf.org', path: '/exhibitions/awe/exh_items.php', query: { eId: '11' }, slug: 'sharinghistory-travelling', family: 'minisite' },
  { host: 'textiles.museumwnf.org', slug: 'textiles', family: 'gallery' },
  { host: 'upgrade-exhibitions.museumwnf.org', path: '/the_hijaz_railway/', slug: 'the-hijaz-railway', family: 'exhibition' },
  { host: 'exhibitions.museumwnf.org', path: '/the_table_is_set/', slug: 'the-table-is-set', family: 'exhibition' },
  { host: 'exhibitions.museumwnf.org', path: '/the_use_of_colours_in_art/', slug: 'the-use-of-colours-in-art', family: 'exhibition' },
  { host: 'theatre.museumwnf.org', slug: 'theatre', family: 'gallery' },
  { host: 'toys-games.museumwnf.org', slug: 'toys-games', family: 'gallery' },
  { host: 'wallpaintings.museumwnf.org', slug: 'wallpaintings', family: 'gallery' },
  { host: 'exhibitions.museumwnf.org', path: '/water_in_islam/', slug: 'water-in-islam', family: 'exhibition' },
  { host: 'weights-measures.museumwnf.org', slug: 'weights-measures', family: 'gallery' },
  { host: 'exhibitions.museumwnf.org', path: '/with_brush_and_qalam/', slug: 'with-brush-and-qalam', family: 'exhibition' },
  { host: 'woodwork.museumwnf.org', slug: 'woodwork', family: 'gallery' },
  { host: 'exhibitions.museumwnf.org', path: '/the_hijaz_railway/', slug: 'the-hijaz-railway', family: 'exhibition' },
  // Legacy's three products also answered on their own domains.
  { host: 'discoverislamicart.org', slug: 'islamicart', family: 'islamicart' },
  { host: 'discoverbaroqueart.org', slug: 'baroqueart', family: 'baroqueart' },
  { host: 'sharinghistory.org', slug: 'sharinghistory', family: 'sharinghistory' },
]

// The new route of each legacy page the products and their siblings link
// to: legacy's script name → the route. A page that is not here stays on
// legacy (a page with no counterpart, or one that needs a record id).
const PAGES = {
  islamicart: {
    '/': '/', '/index.php': '/',
    '/database.php': '/database', '/database_results.php': '/database/results',
    '/partners.php': '/partners', '/pm_partner_list.php': '/partners/results', '/pm_partner_list_eiac.php': '/partners/explore',
    '/pc_entrance.php': '/permanent-collection', '/pclist_all.php': '/permanent-collection/results',
    '/hcr_home.php': '/timeline', '/dynasties/': '/dynasties',
    '/isl_missionstatement.php': '/mission-statement', '/recommendedlinks.php': '/recommended-links',
    '/atrium_sponsor_detail.php': '/sponsors', '/glossarysearch.php': '/glossary-spelling',
  },
  baroqueart: {
    '/': '/', '/index.php': '/',
    '/database.php': '/database', '/database_results.php': '/database/results',
    '/partners.php': '/partners', '/pm_partner_list.php': '/partners/results',
    '/pc_entrance.php': '/permanent-collection', '/pclist_all.php': '/permanent-collection/results',
    '/hcr_home.php': '/timeline', '/atrium_sponsor_detail.php': '/sponsors', '/mwnf_credit.php': '/credits',
  },
  sharinghistory: {
    '/': '/', '/index.php': '/',
    '/about.php': '/about', '/about_team.php': '/about/team', '/about_chronology_list.php': '/about/chronology',
    '/pc_home.php': '/permanent-collection', '/database_searchform.php': '/database',
    '/historical_background.php': '/historical-background', '/hcr_home.php': '/timeline',
    '/exhibitions/awe/index.php': '/exhibitions', '/partners.php': '/partners', '/pm_partner_list.php': '/partners/results',
    '/sponsor_detail.php': '/sponsors', '/sponsor_detail_local.php': '/sponsors/local',
  },
}
// The query keys a page's new route reads as legacy's did.
const KEPT_QUERY = { '/partners/results': ['type'] }

const bareHost = (host) => host.toLowerCase().replace(/^www\./, '')

function rowFor(url) {
  const host = bareHost(url.host)
  const path = url.pathname.toLowerCase().replace(/\/?$/, '/')
  return LEGACY_SITES.filter(
    (row) =>
      row.host === host &&
      path.startsWith((row.path ?? '/').replace(/\.php$/, '.php/')) &&
      Object.entries(row.query ?? {}).every(([key, value]) => url.searchParams.get(key) === value),
  ).sort((a, b) => (b.path ?? '/').length - (a.path ?? '/').length)[0]
}

/**
 * The route on the new site that a legacy address of `row` lands on, or null
 * when it has none. Galleries, Explore and the hub kept legacy's paths as
 * routes (their legacy redirects); an exhibition drops its own segment and
 * moves the language to the query; a mini-site opens on its home; a
 * product's page goes through PAGES.
 */
function routeFor(row, url) {
  // A legacy text may write the address with a space before its closing `>`.
  const pathname = decodeURIComponent(url.pathname).trim() || '/'
  const path = pathname.replace(/\/+$/, '') || '/'
  if (row.family === 'gallery' || row.family === 'explore' || row.family === 'galleries') return `${path}${url.search}`
  if (row.family === 'minisite') return '/'
  if (row.family === 'exhibition') {
    const rest = path.split('/').filter(Boolean).slice(1)
    const lang = /^[a-z]{2}$/.test(rest[0] ?? '') ? rest.shift() : null
    return `/${rest.join('/')}${lang ? `?lang=${lang}` : ''}`
  }
  const route = PAGES[row.family]?.[pathname.toLowerCase()]
  if (!route) return null
  const keep = (KEPT_QUERY[route] ?? []).filter((key) => url.searchParams.has(key))
  return keep.length ? `${route}?${keep.map((key) => `${key}=${encodeURIComponent(url.searchParams.get(key))}`).join('&')}` : route
}

function fixAnchor(anchor) {
  const href = anchor.getAttribute('href')
  const next = toNewSite(href)
  if (next !== href) anchor.setAttribute('href', next)
}

function fixWithin(node) {
  if (node.nodeType !== 1) return
  if (node.matches('a[href]')) fixAnchor(node)
  for (const anchor of node.querySelectorAll('a[href]')) fixAnchor(anchor)
}

/**
 * Keeps every link under `root` on the new sites: each anchor drawn, or
 * given a new `href`, whose address is a legacy site's that has a new one
 * gets the new address. Components, Markdown and a site's own markup all
 * link through it, so no family has to repeat the rule. Its own change
 * fires once more and finds nothing to do. Returns the function that stops
 * it.
 */
export function watchNewSiteLinks(root) {
  if (!root || typeof MutationObserver === 'undefined') return () => {}
  fixWithin(root)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') fixAnchor(record.target)
      else record.addedNodes.forEach(fixWithin)
    }
  })
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] })
  return () => observer.disconnect()
}

/** An address as legacy stored a host (`ceramics.museumwnf.org`), with its scheme. */
export function withScheme(address) {
  return /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : `https://${address}`
}

/**
 * `href` on the new site when it is a legacy MWNF address of a site that has
 * one, else `href` itself. Needs the site's declared origin (`site.origin`):
 * without it every link stays as it is.
 */
export function toNewSite(href) {
  if (typeof href !== 'string') return href
  let url
  try {
    url = new URL(href.trim())
  } catch {
    return href
  }
  if (!/^https?:$/.test(url.protocol)) return href
  const row = rowFor(url)
  if (!row) return href
  const route = routeFor(row, url)
  if (route === null) return href
  return siblingSiteUrl(row.slug, route) ?? href
}
