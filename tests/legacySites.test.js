import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setSiteConfig } from '../src/siteConfig.js'
import { LEGACY_SITES, toNewSite, watchNewSiteLinks, withScheme } from '../src/legacySites.js'
import { md } from '../src/index.js'

// A link to a legacy MWNF site that has a new one goes to the new site
// (inventory-app#2482); every other link stays as it is.
const NEW = 'https://museumwithnofrontiers.github.io'

describe('toNewSite', () => {
  beforeEach(() => setSiteConfig({ site: { origin: `${NEW}/ceramics/` } }))
  afterEach(() => setSiteConfig({}))

  it('sends a gallery, the hub and Explore to the same path on the new site', () => {
    expect(toNewSite('https://amulets.museumwnf.org/')).toBe(`${NEW}/amulets/#/`)
    expect(toNewSite('https://ceramics.museumwnf.org/collection')).toBe(`${NEW}/ceramics/#/collection`)
    expect(toNewSite('https://galleries.museumwnf.org/list/1')).toBe(`${NEW}/galleries/#/list/1`)
    expect(toNewSite('https://explore.museumwnf.org/about')).toBe(`${NEW}/explore/#/about`)
  })

  it("sends a product's page to its new route, keeping the list type", () => {
    expect(toNewSite('https://islamicart.museumwnf.org/')).toBe(`${NEW}/islamicart/#/`)
    expect(toNewSite('https://islamicart.museumwnf.org/database.php')).toBe(`${NEW}/islamicart/#/database`)
    expect(toNewSite('https://islamicart.museumwnf.org/pm_partner_list.php?type=museum')).toBe(`${NEW}/islamicart/#/partners/results?type=museum`)
    expect(toNewSite('https://baroqueart.museumwnf.org/mwnf_credit.php')).toBe(`${NEW}/baroqueart/#/credits`)
    expect(toNewSite('https://sharinghistory.museumwnf.org/about_team.php')).toBe(`${NEW}/sharinghistory/#/about/team`)
  })

  // The ids are the published packages' own: publications-data's book
  // `mwnf3:bookbase:5`, travels-data's trail `mwnf3_travels:trail:IAM:dz:1`
  // and itinerary `mwnf3_travels:itinerary:IAM:tn:1:I`.
  it('sends a legacy book, a category and a search to the Publications site', () => {
    const book = '4a74f98f-eeaf-53ea-9c47-c31ebc1c8cfb'
    expect(toNewSite('https://books.museumwnf.org/')).toBe(`${NEW}/publications/#/`)
    expect(toNewSite('https://books.museumwnf.org/book/5/en')).toBe(`${NEW}/publications/#/publication/${book}/en`)
    expect(toNewSite('https://books.museumwnf.org/book/5')).toBe(`${NEW}/publications/#/publication/${book}`)
    expect(toNewSite('https://books.museumwnf.org/category/travel-books/2')).toBe(`${NEW}/publications/#/category/travel-books?page=2`)
    expect(toNewSite('https://books.museumwnf.org/category/new/1')).toBe(`${NEW}/publications/#/category/new`)
    expect(toNewSite('https://books.museumwnf.org/results?title=light&c=x')).toBe(`${NEW}/publications/#/results?title=light`)
    expect(toNewSite('https://books.museumwnf.org/sign-up')).toBe('https://books.museumwnf.org/sign-up')
  })

  it("sends legacy's Exhibition Trails to the Travels site, its tab and language in the query", () => {
    const trail = '06c4a15f-0473-5ab8-a5ce-e85562d75351'
    const itinerary = 'cbcc1e88-5eda-5ac4-8cf9-6b8fb6a20bad'
    const legacy = 'https://travels.museumwnf.org'
    expect(toNewSite(`${legacy}/travel_et_home.php`)).toBe(`${NEW}/travels/#/`)
    expect(toNewSite(`${legacy}/travel_et_trail.php?cid=tn`)).toBe(`${NEW}/travels/#/trails?country=tun`)
    expect(toNewSite(`${legacy}/travel_et_trail.php?tid=IAM`)).toBe(`${NEW}/travels/#/trails?project=IAM`)
    expect(toNewSite(`${legacy}/travel_et_trailDetail.php?id=IAM;dz;1;en&fl=its`)).toBe(`${NEW}/travels/#/trail/${trail}?tab=its&lang=en`)
    expect(toNewSite(`${legacy}/travel_et_trailDetail.php?id=IAM;dz;1;fr&fl=reltou`)).toBe(`${NEW}/travels/#/trail/${trail}?lang=fr`)
    expect(toNewSite(`${legacy}/travel_et_itenary.php?id=IAM;tn;I;en;1&fl=des&itrNo=11`)).toBe(`${NEW}/travels/#/itinerary/${itinerary}?tab=des&lang=en`)
    // Legacy's tours and booking form have no new site.
    for (const href of [`${legacy}/`, `${legacy}/booking_form.php`, `${legacy}/travel_et_trail.php?cid=xx`]) expect(toNewSite(href)).toBe(href)
  })

  it('keeps a product page that has no new counterpart on legacy', () => {
    expect(toNewSite('https://islamicart.museumwnf.org/mwnf_credit.php')).toBe('https://islamicart.museumwnf.org/mwnf_credit.php')
  })

  it('sends a mini-site to its home, a Sharing History one by its eId', () => {
    expect(toNewSite('https://islamicart.museumwnf.org/exhibitions/ISL/arabic_calligraphy/?lng=en')).toBe(`${NEW}/islamicart-arabic-calligraphy/#/`)
    expect(toNewSite('https://islamicart.museumwnf.org/gai/ISL/')).toBe(`${NEW}/islamicart-artistic-introduction/#/`)
    expect(toNewSite('https://sharinghistory.museumwnf.org/exhibitions/AWE/exh_items.php?eId=8')).toBe(`${NEW}/sharinghistory-migrations/#/`)
  })

  it("sends an exhibition's page there, the language in the query", () => {
    expect(toNewSite('https://exhibitions.museumwnf.org/water_in_islam/en/')).toBe(`${NEW}/water-in-islam/#/?lang=en`)
    expect(toNewSite('https://exhibitions.museumwnf.org/water_in_islam/en/theme/2')).toBe(`${NEW}/water-in-islam/#/theme/2?lang=en`)
  })

  it("reads legacy's own domains, a www prefix and a stray space", () => {
    expect(toNewSite('http://www.discoverislamicart.org/index.php')).toBe(`${NEW}/islamicart/#/`)
    expect(toNewSite('https://baroqueart.museumwnf.org/ ')).toBe(`${NEW}/baroqueart/#/`)
  })

  it('leaves every other link alone', () => {
    for (const href of [
      'https://www.museumwnf.org/about/credits',
      'https://www.example.org/',
      'mailto:editing@museumwnf.net',
      '#/partners',
      `${NEW}/amulets/#/`,
    ]) expect(toNewSite(href)).toBe(href)
  })

  it('leaves every link alone where the site declares no origin', () => {
    setSiteConfig({})
    expect(toNewSite('https://amulets.museumwnf.org/')).toBe('https://amulets.museumwnf.org/')
  })

  it("gives a stored host its scheme", () => {
    expect(withScheme('ceramics.museumwnf.org')).toBe('https://ceramics.museumwnf.org')
    expect(withScheme('http://x.org')).toBe('http://x.org')
  })

  it('lists each new site once by its legacy address', () => {
    const keys = LEGACY_SITES.map((row) => `${row.host}${row.path ?? '/'}${JSON.stringify(row.query ?? {})}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('watchNewSiteLinks', () => {
  beforeEach(() => setSiteConfig({ site: { origin: `${NEW}/ceramics/` } }))
  afterEach(() => setSiteConfig({}))

  it('moves every anchor drawn or re-addressed to the new site, and stops when asked', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<a href="https://amulets.museumwnf.org/">Amulets</a><a href="https://www.museumwnf.org/">Portal</a>'
    const stop = watchNewSiteLinks(root)
    expect(root.children[0].getAttribute('href')).toBe(`${NEW}/amulets/#/`)
    expect(root.children[1].getAttribute('href')).toBe('https://www.museumwnf.org/')

    const added = document.createElement('a')
    added.setAttribute('href', 'https://islamicart.museumwnf.org/')
    root.append(added)
    root.children[1].setAttribute('href', 'https://galleries.museumwnf.org/list/1')
    await new Promise((resolve) => setTimeout(resolve))
    expect(added.getAttribute('href')).toBe(`${NEW}/islamicart/#/`)
    expect(root.children[1].getAttribute('href')).toBe(`${NEW}/galleries/#/list/1`)

    stop()
    root.children[0].setAttribute('href', 'https://carpets.museumwnf.org/')
    await new Promise((resolve) => setTimeout(resolve))
    expect(root.children[0].getAttribute('href')).toBe('https://carpets.museumwnf.org/')
  })
})

describe('Markdown links to legacy sites', () => {
  beforeEach(() => setSiteConfig({ site: { origin: `${NEW}/ceramics/` } }))
  afterEach(() => setSiteConfig({}))

  it("go to the new site, the text's words unchanged", () => {
    const html = md('Visit [Discover Islamic Art](https://islamicart.museumwnf.org/) and [My Collection](https://www.museumwnf.org/mycollection/index.php).')
    expect(html).toContain(`href="${NEW}/islamicart/#/"`)
    expect(html).toContain('>Discover Islamic Art<')
    expect(html).toContain('href="https://www.museumwnf.org/mycollection/index.php"')
  })
})
