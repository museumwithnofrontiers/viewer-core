// Seven partner lists group by country seven ways. The standalone sites
// (islamicart, baroqueart, sharinghistory) bucket each country's partners
// into "main" and "associated" on a `level` field and render an accordion;
// the DXA sites (carpets and its siblings) group the same way but add an
// A-Z / Z-A toggle and no tiers at all. Both are this one derivation with a
// couple of options — pure, so the site's own view supplies the toggle and
// the label lookup.
//
// `parent_id` is carried on a third of the standalone partners and read
// nowhere: legacy nested an associated partner under the main partner it
// belongs to, and the port flattened that into the country column instead.
// `partnerHierarchy` is that relationship, read once.
//
// `partnerView` is what every rendering of one partner reads — a list line,
// the summary under an item's holder, the partner page — built once here so
// the contact block, the contact persons and the picture captions are read
// the same way on every site. A partner is one type in every exporter family
// (decision D4 of inventory-app#1699); what differs by family is only what
// `ctx` carries.

import { md as mdBlock, mdInline as mdInlineDefault, mdStrip as mdStripDefault } from '../i18n/markdown.js'

/**
 * Whether `record` counts as a main (rather than associated) partner.
 * `tier` names the field the converged partner shape carries (`level`).
 * A record is associated only when its tier value is a non-empty value
 * other than `'partner'` (legacy values: `'associated_partner'`,
 * `'minor_contributor'`); `null`, `undefined`, `''`, or `'partner'` mean
 * main. This is necessary because exporters emit `level: null` for every
 * partner without curated hierarchy. Without a `tier` at all there is nothing
 * to divide records on, so every record is main, which is what a caller with
 * no tiers (the DXA lists) wants.
 */
function isMainTier(record, tier) {
  if (!tier) return true
  const tierValue = record?.[tier]
  // Treat null, undefined, empty string, or 'partner' as main
  return tierValue == null || tierValue === '' || tierValue === 'partner'
}

/**
 * Partner records grouped by country: `[{ country, label, main, associated
 * }]`, one entry per distinct `country_id` (partners with none share a
 * `null` group), sorted by `label`, ascending unless `order: 'desc'`.
 * `label(country)` names a group's country — the caller's own lookup, the
 * same shape as a facet's `label(value)` — since a partner record carries
 * only the id. `tier` names the field that marks a main partner (see
 * `isMainTier`); without it every record lands in `main` and `associated`
 * is always empty, which covers the DXA lists' plain grouping. Partners
 * keep the relative order `records` was given in within each tier — sorting
 * them by their own label is the view's concern, not this derivation's.
 */
export function groupByCountry(records, { label, tier, order = 'asc' } = {}) {
  const groups = new Map()
  for (const record of records ?? []) {
    const country = record?.country_id ?? null
    if (!groups.has(country)) groups.set(country, { country, main: [], associated: [] })
    const group = groups.get(country)
    ;(isMainTier(record, tier) ? group.main : group.associated).push(record)
  }
  const rows = [...groups.values()].map((group) => ({ ...group, label: label ? label(group.country) : group.country }))
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label)))
  return order === 'desc' ? rows.reverse() : rows
}

/**
 * The partner hierarchy `parent_id` encodes: `children(id)` (a partner's
 * associated partners), `parentOf(id)` (the main partner it belongs to, or
 * null), `roots` (every partner with no parent in the list, or whose
 * `parent_id` points outside it). A partner referencing a `parent_id` this
 * list does not carry is treated as a root rather than dropped — the same
 * "keep the reference, don't invent or discard" rule `relatedRecords` uses.
 */
export function partnerHierarchy(partners) {
  const list = partners ?? []
  const byId = new Map(list.map((partner) => [partner.id, partner]))
  const childrenOf = new Map()
  const roots = []
  for (const partner of list) {
    const parent = partner?.parent_id != null ? byId.get(partner.parent_id) : null
    if (parent) {
      if (!childrenOf.has(parent.id)) childrenOf.set(parent.id, [])
      childrenOf.get(parent.id).push(partner)
    } else {
      roots.push(partner)
    }
  }
  return {
    children: (id) => childrenOf.get(id) ?? [],
    parentOf: (id) => {
      const partner = byId.get(id)
      return partner?.parent_id != null ? (byId.get(partner.parent_id) ?? null) : null
    },
    roots,
  }
}

// ── One partner, for rendering ───────────────────────────────────────────────

/**
 * A partner's website or extra link, as an address a link can use. A value
 * with no scheme (`www.example.org`, about a quarter of the packages' links)
 * gets `https://` (decided 2026-09-25, inventory-app#2031); `http://` and
 * `https://` are kept as they are. Any other scheme (`javascript:`, `data:`,
 * `mailto:`) is not a website and yields `''`, so it never reaches an `href`.
 * A port after a bare host (`host:8080`) is not a scheme.
 */
function websiteUrl(value) {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) return ''
  return `https://${url}`
}

const byDisplayOrder = (a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0)

/**
 * The contact persons in legacy order (person 1 first), keeping only those
 * with a name or a title — legacy printed a person block only then.
 */
function contactPersons(partner) {
  const list = Array.isArray(partner?.contact_persons) ? partner.contact_persons : []
  return list
    .filter((person) => person && (person.name || person.title))
    .map((person) => ({
      title: person.title ?? '',
      name: person.name ?? '',
      phone: person.phone ?? '',
      fax: person.fax ?? '',
      email: person.email ?? '',
    }))
}

/**
 * The view-model of one partner: what viewer-layout's `PartnerPanel` renders
 * in each of its variants, and what any other rendering of a partner reads.
 *
 * `partner` is a `partners.json` record; `text` its translation in the
 * language shown (`{ name, description, city, address, phone, fax, email,
 * website }`). `ctx` carries what differs by family, nothing else:
 *
 * - `countryLabel(countryId)` — the country's name;
 * - `md`, `mdInline`, `mdStrip` — the renderers, when the site binds its
 *   own (a glossary); the package's by default;
 * - `route(partner)` — the partner's own page;
 * - `objectsRoute(partner)` — the page of the items it holds;
 * - `hidden(partner)` — a partner with no page of its own (the exhibitions'
 *   rule): it keeps its name, and loses both links.
 *
 * Text is rendered once here: `name` and `description` are HTML (inline and
 * block), `address` is block HTML; every other field is plain text.
 */
export function partnerView(partner, text = {}, ctx = {}) {
  if (!partner) return null
  const t = text ?? {}
  const {
    countryLabel = (id) => (id ?? ''),
    md = mdBlock,
    mdInline = mdInlineDefault,
    mdStrip = mdStripDefault,
    route = null,
    objectsRoute = null,
    hidden = null,
  } = ctx

  const source = String(t.name ?? partner.internal_name ?? partner.id)
  const plainName = mdStrip(source)
  const city = t.city ? String(t.city) : ''
  const country = partner.country_id ? (countryLabel(partner.country_id) ?? '') : ''
  const isHidden = hidden ? Boolean(hidden(partner)) : false
  const itemCount = partner.item_count ?? 0
  const website = websiteUrl(t.website)
  const links = (partner.additional_urls ?? [])
    .map((link) => ({ url: websiteUrl(link?.url), label: link?.title || link?.url || '' }))
    .filter((link) => link.url)
  const hasMap = Number.isFinite(partner.latitude) && Number.isFinite(partner.longitude)

  const view = {
    id: partner.id,
    type: partner.type ?? '',
    name: mdInline(source),
    plainName,
    city,
    country,
    location: [city, country].filter(Boolean).join(', '),
    logos: [...(partner.logos ?? [])].sort(byDisplayOrder).map((logo) => ({
      url: logo.url,
      alt: logo.alt_text || plainName,
      type: logo.logo_type ?? '',
    })),
    // A partner's pictures carry `alt_text`, not the per-language
    // `captions` an item's images do: the alt text is the caption.
    pictures: [...(partner.images ?? [])].sort(byDisplayOrder).map((picture) => ({
      url: picture.url,
      alt: picture.alt_text || plainName,
      caption: picture.alt_text ?? '',
      photographer: picture.photographer ?? '',
      copyright: picture.copyright ?? '',
    })),
    description: md(t.description ?? ''),
    contact: {
      address: md(t.address ?? ''),
      phone: t.phone ?? '',
      fax: t.fax ?? '',
      email: t.email ?? '',
      website: website ? { url: website, label: String(t.website).trim() } : null,
      links,
    },
    persons: contactPersons(partner),
    map: hasMap
      ? { latitude: partner.latitude, longitude: partner.longitude, zoom: partner.map_zoom ?? 15, label: plainName }
      : null,
    itemCount,
    hidden: isHidden,
    route: !isHidden && route ? (route(partner) ?? null) : null,
    objectsRoute: !isHidden && itemCount && objectsRoute ? (objectsRoute(partner) ?? null) : null,
  }
  view.hasContact = Boolean(
    view.contact.address || view.contact.phone || view.contact.fax || view.contact.email
      || view.contact.website || view.contact.links.length || view.persons.length,
  )
  return view
}