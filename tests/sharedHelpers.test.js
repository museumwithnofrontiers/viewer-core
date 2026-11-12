import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createI18n, createStandardViewer, loadEntities, textsByLanguage, useCatalogueResults } from '../src/index.js'
import { checkChromeSources } from '../src/testing/index.js'

describe('textsByLanguage', () => {
  it('keys each locales file by its language, the way every main.js did', () => {
    const modules = {
      '../locales/en.json': { default: { 'site.title': 'Ceramics' } },
      '../locales/ar.json': { default: { 'site.title': 'خزف' } },
    }
    expect(textsByLanguage(modules)).toEqual({ en: { 'site.title': 'Ceramics' }, ar: { 'site.title': 'خزف' } })
    expect(textsByLanguage(undefined)).toEqual({})
  })
})

describe('createStandardViewer(config, options)', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('takes the options as its second argument', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createStandardViewer(
      { datasetPackage: '@museumwnf/fixture-data', siteName: 'Fixture Museum', features: { entities: [] } },
      { dictionary: { en: { 'core.nav.home': 'Home' } }, ownMessages: { en: { 'core.nav.home': 'Welcome' } }, el: host },
    )
    await app.config.globalProperties.$router.isReady()
    expect(app.config.globalProperties.$t('core.nav.home')).toBe('Welcome')
    app.unmount()
  })

  it('still takes a shell as its second argument in the older form', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const Shell = defineComponent({ setup: (_, { slots }) => () => h('div', { class: 'older-shell' }, slots.default?.()) })
    const app = createStandardViewer(
      { datasetPackage: '@museumwnf/fixture-data', siteName: 'Fixture Museum', features: { entities: [] }, messages: { en: {} } },
      Shell,
      { el: host },
    )
    await app.config.globalProperties.$router.isReady()
    expect(host.querySelector('.older-shell')).not.toBeNull()
    app.unmount()
  })
})

describe('checkChromeSources', () => {
  let root
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  function site(files, extra = {}) {
    root = mkdtempSync(join(tmpdir(), 'chrome-'))
    mkdirSync(join(root, 'theme/assets/legacy/sub'), { recursive: true })
    const sources = { files: {} }
    for (const [path, bytes] of Object.entries(files)) {
      writeFileSync(join(root, path), bytes)
      sources.files[path] = { sha256: createHash('sha256').update(bytes).digest('hex') }
    }
    for (const [path, bytes] of Object.entries(extra)) writeFileSync(join(root, path), bytes)
    return sources
  }

  it('passes a folder that holds exactly what SOURCES.json lists, byte for byte', () => {
    const sources = site({ 'theme/assets/legacy/a.gif': 'A', 'theme/assets/legacy/sub/b.jpg': 'B' })
    expect(checkChromeSources(sources, { root })).toEqual([])
  })

  it('names a changed file, a missing one and an unlisted one', () => {
    const sources = site({ 'theme/assets/legacy/a.gif': 'A' }, { 'theme/assets/legacy/stray.png': 'S' })
    sources.files['theme/assets/legacy/gone.gif'] = { sha256: 'x' }
    writeFileSync(join(root, 'theme/assets/legacy/a.gif'), 'changed')
    expect(checkChromeSources(sources, { root }).sort()).toEqual([
      'theme/assets/legacy/a.gif: not the file legacy serves',
      'theme/assets/legacy/gone.gif: missing',
      'theme/assets/legacy/stray.png: not listed in SOURCES.json',
    ])
  })
})

describe('useCatalogueResults', () => {
  beforeAll(() => loadEntities(['objects']))

  async function mountResults(spec, query = {}) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/results', name: 'results', component: { template: '<p />' } }, { path: '/item/:id', name: 'item', component: { template: '<p />' } }],
    })
    await router.push({ name: 'results', query })
    let api
    mount({ setup() { api = useCatalogueResults(spec); return () => null } }, {
      global: { plugins: [router, createI18n({ messages: { en: { 'catalogue.results.itemsFound': 'Items found' } } })] },
    })
    await nextTick()
    return api
  }

  it('narrows the records by the facets the URL carries, a page at a time', async () => {
    const spec = { entity: 'objects', facets: { country: { field: 'country_id' } }, pageSize: 1, sort: false }
    const all = await mountResults(spec)
    const egypt = await mountResults(spec, { country: 'c-eg' })
    expect(all.matching.value.length).toBeGreaterThan(1)
    expect(egypt.matching.value.every((record) => record.country_id === 'c-eg')).toBe(true)
    expect(all.pageInfo.value.rows).toHaveLength(1)
    expect(all.summary.value).toEqual([{ label: 'Items found', count: all.matching.value.length }])
  })

  it('draws each row with the spec’s own record function, else the default row', async () => {
    const own = await mountResults({ entity: 'objects', sort: false, record: (record) => ({ id: record.id, own: true }) })
    expect(own.rows.value[0]).toEqual({ id: own.matching.value[0].id, own: true })
    const plain = await mountResults({ entity: 'objects', sort: false })
    expect(plain.rows.value[0].to).toEqual({ name: 'item', params: { id: plain.matching.value[0].id } })
  })
})
