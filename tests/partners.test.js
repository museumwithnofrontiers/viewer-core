import { describe, expect, it } from 'vitest'
import { groupByCountry, partnerHierarchy, partnerView } from '../src/index.js'

const countryLabels = { 'country-fr': 'France', 'country-de': 'Germany' }
const label = (country) => countryLabels[country] ?? 'Other'

const partners = [
  { id: 'partner-fr-owner', country_id: 'country-fr', level: 'partner', parent_id: null },
  { id: 'partner-fr-assoc-1', country_id: 'country-fr', level: 'associated_partner', parent_id: 'partner-fr-owner' },
  { id: 'partner-fr-assoc-2', country_id: 'country-fr', level: 'associated_partner', parent_id: 'partner-fr-owner' },
  { id: 'partner-de-plain', country_id: 'country-de', parent_id: null },
]

describe('groupByCountry', () => {
  it('puts every record in main when no tier is named', () => {
    const rows = groupByCountry(partners, { label })
    expect(rows.map((r) => r.country)).toEqual(['country-fr', 'country-de'])
    expect(rows[0].main.map((p) => p.id)).toEqual(['partner-fr-owner', 'partner-fr-assoc-1', 'partner-fr-assoc-2'])
    expect(rows[0].associated).toEqual([])
    expect(rows[1].main.map((p) => p.id)).toEqual(['partner-de-plain'])
  })

  it('splits main and associated on the named tier field, by the value "partner"', () => {
    const rows = groupByCountry(partners, { label, tier: 'level' })
    const france = rows.find((r) => r.country === 'country-fr')
    expect(france.main.map((p) => p.id)).toEqual(['partner-fr-owner'])
    expect(france.associated.map((p) => p.id)).toEqual(['partner-fr-assoc-1', 'partner-fr-assoc-2'])
    // A partner with no tier field (null or undefined) is treated as main,
    // not associated, because exporters emit level: null for partners without
    // curated hierarchy.
    const germany = rows.find((r) => r.country === 'country-de')
    expect(germany.main.map((p) => p.id)).toEqual(['partner-de-plain'])
    expect(germany.associated).toEqual([])
  })

  it('sorts groups by label, ascending by default and descending on request', () => {
    const asc = groupByCountry(partners, { label })
    expect(asc.map((r) => r.label)).toEqual(['France', 'Germany'])
    const desc = groupByCountry(partners, { label, order: 'desc' })
    expect(desc.map((r) => r.label)).toEqual(['Germany', 'France'])
  })

  it('groups partners with no country under one null group', () => {
    const rows = groupByCountry([...partners, { id: 'no-country' }], { label })
    const other = rows.find((r) => r.country == null)
    expect(other.main.map((p) => p.id)).toEqual(['no-country'])
  })
})

describe('partnerHierarchy', () => {
  it('finds an owner\'s associated partners by parent_id', () => {
    const { children } = partnerHierarchy(partners)
    expect(children('partner-fr-owner').map((p) => p.id)).toEqual(['partner-fr-assoc-1', 'partner-fr-assoc-2'])
    expect(children('partner-de-plain')).toEqual([])
  })

  it('answers a partner\'s parent, or null for one with none', () => {
    const { parentOf } = partnerHierarchy(partners)
    expect(parentOf('partner-fr-assoc-1')?.id).toBe('partner-fr-owner')
    expect(parentOf('partner-fr-owner')).toBeNull()
    expect(parentOf('partner-de-plain')).toBeNull()
  })

  it('lists every partner with no parent, or a parent_id outside the list, as a root', () => {
    const { roots } = partnerHierarchy([...partners, { id: 'orphan', parent_id: 'not-in-list' }])
    expect(roots.map((p) => p.id)).toEqual(['partner-fr-owner', 'partner-de-plain', 'orphan'])
  })
})

describe('partnerView', () => {
  const partner = {
    id: 'p-cairo',
    type: 'museum',
    country_id: 'country-eg',
    latitude: 30.0478,
    longitude: 31.2336,
    map_zoom: 16,
    item_count: 12,
    contact_persons: [
      { title: 'Director', name: 'A. First', phone: '+20 1', fax: '+20 2', email: 'first@example.org' },
      { phone: '+20 9' },
      { name: 'B. Second' },
    ],
    additional_urls: [{ url: 'www.friends.example.org', title: 'Friends' }, { url: 'javascript:alert(1)' }],
    images: [
      { url: 'b.jpg', alt_text: 'The courtyard', display_order: 2, photographer: 'P', copyright: 'C' },
      { url: 'a.jpg', alt_text: null, display_order: 1 },
    ],
    logos: [{ url: 'logo.png', logo_type: 'primary', alt_text: null, display_order: 1 }],
  }
  const text = {
    name: 'Museum of *Islamic* Art',
    city: 'Cairo',
    description: 'A museum.',
    address: 'Port Said Street',
    phone: '+20 0',
    fax: '+20 3',
    email: 'info@example.org',
    website: 'www.example.org',
  }
  const ctx = {
    countryLabel: (id) => ({ 'country-eg': 'Egypt' })[id],
    route: (p) => ({ name: 'partner', params: { id: p.id } }),
    objectsRoute: (p) => ({ name: 'partner-objects', params: { id: p.id } }),
  }

  it('names and places the partner', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.name).toBe('Museum of <em>Islamic</em> Art')
    expect(view.plainName).toBe('Museum of Islamic Art')
    expect(view.location).toBe('Cairo, Egypt')
    expect(partnerView({ ...partner, country_id: null }, { name: 'X' }, ctx).location).toBe('')
  })

  it('keeps the contact persons in order, dropping those with neither a name nor a title', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.persons.map((p) => p.name || p.title)).toEqual(['A. First', 'B. Second'])
    expect(view.persons[0]).toEqual({ title: 'Director', name: 'A. First', phone: '+20 1', fax: '+20 2', email: 'first@example.org' })
  })

  it('reads contact_persons only: the legacy contact_person_1/_2 pair is gone (inventory-app#2007)', () => {
    const old = { ...partner, contact_persons: undefined, contact_person_1: { name: 'One' } }
    expect(partnerView(old, text, ctx).persons).toEqual([])
    expect(partnerView({ ...partner, contact_persons: [] }, text, ctx).persons).toEqual([])
  })

  it('shows the partner fax next to the phone', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.contact.phone).toBe('+20 0')
    expect(view.contact.fax).toBe('+20 3')
    expect(view.hasContact).toBe(true)
  })

  it('adds https:// to a link without a scheme, keeps http(s), and drops any other scheme', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.contact.website).toEqual({ url: 'https://www.example.org', label: 'www.example.org' })
    expect(view.contact.links).toEqual([{ url: 'https://www.friends.example.org', label: 'Friends' }])
    expect(partnerView(partner, { ...text, website: 'http://old.example.org' }, ctx).contact.website.url).toBe('http://old.example.org')
    expect(partnerView(partner, { ...text, website: 'HTTPS://x.example.org' }, ctx).contact.website.url).toBe('HTTPS://x.example.org')
    expect(partnerView(partner, { ...text, website: 'example.org:8080/path' }, ctx).contact.website.url).toBe('https://example.org:8080/path')
    expect(partnerView(partner, { ...text, website: 'javascript:alert(1)' }, ctx).contact.website).toBeNull()
  })

  it('captions pictures from alt_text, in display order', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.pictures.map((p) => p.url)).toEqual(['a.jpg', 'b.jpg'])
    expect(view.pictures[1]).toEqual({ url: 'b.jpg', alt: 'The courtyard', caption: 'The courtyard', photographer: 'P', copyright: 'C' })
    // No alt text: the partner's name is the image's alt, and there is no caption.
    expect(view.pictures[0].alt).toBe('Museum of Islamic Art')
    expect(view.pictures[0].caption).toBe('')
    expect(view.logos).toEqual([{ url: 'logo.png', alt: 'Museum of Islamic Art', type: 'primary' }])
  })

  it('links the page and the objects, unless the partner is hidden or holds nothing', () => {
    const view = partnerView(partner, text, ctx)
    expect(view.route).toEqual({ name: 'partner', params: { id: 'p-cairo' } })
    expect(view.objectsRoute).toEqual({ name: 'partner-objects', params: { id: 'p-cairo' } })
    expect(view.itemCount).toBe(12)
    expect(partnerView({ ...partner, item_count: 0 }, text, ctx).objectsRoute).toBeNull()
    const hidden = partnerView(partner, text, { ...ctx, hidden: () => true })
    expect(hidden.hidden).toBe(true)
    expect(hidden.route).toBeNull()
    expect(hidden.objectsRoute).toBeNull()
  })

  it('places the map only where the partner has coordinates', () => {
    expect(partnerView(partner, text, ctx).map).toEqual({ latitude: 30.0478, longitude: 31.2336, zoom: 16, label: 'Museum of Islamic Art' })
    expect(partnerView({ ...partner, latitude: null }, text, ctx).map).toBeNull()
  })

  it('reads a partner with nothing but an id', () => {
    const view = partnerView({ id: 'p-bare' })
    expect(view.name).toBe('p-bare')
    expect(view.persons).toEqual([])
    expect(view.pictures).toEqual([])
    expect(view.hasContact).toBe(false)
    expect(view.route).toBeNull()
    expect(partnerView(null)).toBeNull()
  })
})