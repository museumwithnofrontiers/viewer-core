import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import {
  byId, createI18n, glossaryTermsForText, loadEntities, sheetRows, useDataPackage, useRecordSheet,
} from '../src/index.js'
import { messages } from './fixtures/messages.js'

async function settle(ready) {
  for (let i = 0; i < 20 && !ready.value; i++) await new Promise((r) => setTimeout(r, 5))
}

function mountSheet(record, options, locale = 'fr') {
  const i18n = createI18n({ messages, locale })
  let api
  mount({ setup() { api = useRecordSheet(record, options); return () => null } }, { global: { plugins: [i18n] } })
  return { ...api, locale: i18n.locale }
}

// The package's record, as a page has it, plus the languages it carries.
const object = (id, languages) => ({ ...byId('objects').value.get(id), languages })

beforeAll(() => loadEntities(['objects', 'glossary']))

describe('useRecordSheet', () => {
  it('loads the record and its related entities in the record language, then says so', async () => {
    const record = ref(object('o1', ['en', 'fr']))
    const sheet = mountSheet(record, { entity: 'objects', translations: ['glossary'] })
    expect(sheet.language.value).toBe('fr')
    await settle(sheet.ready)
    expect(sheet.ready.value).toBe(true)
    expect(sheet.text.value.name).toBe('Bol glaçuré')
    expect(sheet.terms.value).toEqual([
      { id: 'g1', word: 'kufic', definition: 'Une écriture arabe anguleuse.', spellings: ['coufique', 'écriture coufique'] },
    ])
    expect(sheet.glossary.value.map((e) => e.spelling)).toEqual(['coufique', 'écriture coufique'])
  })

  it('falls back to English for the text, not for the glossary, and follows the toggle', async () => {
    const record = ref(object('o3', ['en', 'fr']))
    const sheet = mountSheet(record, { entity: 'objects', translations: ['glossary'] })
    await settle(sheet.ready)
    // o3 has no French row: its text is the English one, as legacy's PHP sheet
    // read it. g2 has no French row, and legacy linked no term through another
    // language.
    expect(sheet.text.value.name).toBe('Fragment')
    expect(sheet.terms.value.map((t) => t.id)).toEqual(['g1'])
    sheet.select('en')
    await settle(sheet.ready)
    expect(sheet.language.value).toBe('en')
    expect(sheet.terms.value[0].spellings).toEqual(['kufic', 'kufic script'])
  })

  it('supplies a credit from another language when the active one has none', async () => {
    // o4's author is filed on the English row only; read in French, the sheet
    // still credits them, and says where the credit came from.
    const record = ref(object('o4', ['en', 'fr']))
    const sheet = mountSheet(record, { entity: 'objects', attribution: ['author'] })
    await settle(sheet.ready)
    expect(sheet.text.value.author).toBeUndefined()
    expect(sheet.attribution.value).toEqual({ from: 'en', author: 'B. Author' })
  })

  it('starts again when the record changes', async () => {
    const record = ref(object('o1', ['en', 'fr']))
    const sheet = mountSheet(record, { entity: 'objects' })
    await settle(sheet.ready)
    record.value = object('o2', ['en'])
    await nextTick()
    await settle(sheet.ready)
    expect(sheet.language.value).toBe('en')
    expect(sheet.text.value.name).toBe('Mosque lamp')
    expect(sheet.terms.value).toEqual([])
  })

  it('needs to know the entity', () => {
    expect(() => mountSheet(ref(null), {})).toThrow(/entity/)
  })
})

// A dynasty history or a theme essay has no `glossary_ids` column to read —
// this is the scan that stands in for it, over the whole glossary.
describe('glossaryTermsForText', () => {
  beforeAll(async () => {
    const { loadTranslations } = useDataPackage()
    await loadTranslations('glossary', 'en')
    await loadTranslations('glossary', 'fr')
  })

  it('scans the whole glossary against the text, in the language asked', () => {
    const terms = glossaryTermsForText('A pot with a fine glaze, in kufic script.', 'en')
    expect(terms.map((t) => t.id).sort()).toEqual(['g1', 'g2'])
    expect(terms.find((t) => t.id === 'g1').spellings).toEqual(['kufic', 'kufic script'])
  })

  it('finds no term through another language when it has no row in the language asked', () => {
    // g2 has no French row, so its English spelling "glaze" is not a French term.
    const terms = glossaryTermsForText('Un bol en glaze, coufique.', 'fr')
    expect(terms.map((t) => t.id).sort()).toEqual(['g1'])
    expect(terms.find((t) => t.id === 'g1').spellings).toEqual(['coufique', 'écriture coufique'])
  })

  it('finds nothing for a text that names no term, or for no text at all', () => {
    expect(glossaryTermsForText('Nothing relevant here.', 'en')).toEqual([])
    expect(glossaryTermsForText('', 'en')).toEqual([])
    expect(glossaryTermsForText(null, 'en')).toEqual([])
  })
})

describe('sheetRows', () => {
  const ctx = {
    record: { id: 'o1', owner_reference: 'INV-1', artist_names: ['A', 'B'] },
    text: { name: 'Glazed *bowl*', description: 'A bowl in kufic script.\nSecond line.', dimensions: '', type: 'Ceramic', linkcatalogs: 'https://example.org/1' },
    glossary: [{ id: 'g1', spelling: 'kufic' }],
    monument: false,
  }
  const spec = [
    { key: 'name', label: 'Name' },
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'inventory', label: 'Inventory', value: (c) => c.record.owner_reference, render: 'plain' },
    { key: 'artists', label: 'Artists', value: (c) => c.record.artist_names, join: '; ' },
    { key: 'description', label: 'Description', render: 'block' },
    { key: 'catalogue', label: 'Catalogue', value: 'linkcatalogs', render: 'link' },
    { key: 'museum', label: (c) => `Museum of ${c.record.id}`, value: () => 'm1', render: 'custom' },
    { key: 'history', label: 'History', when: (c) => c.monument },
  ]

  it('turns a spec into rows, dropping the empty and the gated, rendering through the pipeline', () => {
    const rows = sheetRows(spec, ctx)
    expect(rows.map((r) => r.key)).toEqual(['name', 'inventory', 'artists', 'description', 'catalogue', 'museum'])
    expect(rows[0].html).toBe('Glazed <em>bowl</em>')
    expect(rows[1].html).toBe('INV-1')
    expect(rows[2].value).toBe('A; B')
    expect(rows[3].html).toContain('<span class="gloss-term" data-gid="g1">kufic</span>')
    expect(rows[3].html).toContain('<br>')
    expect(rows[4]).toMatchObject({ render: 'link', value: 'https://example.org/1', html: null })
    expect(rows[5]).toMatchObject({ label: 'Museum of o1', value: 'm1', html: null })
  })

  it('refuses a rendering it does not know', () => {
    expect(() => sheetRows([{ key: 'name', render: 'html' }], ctx)).toThrow(/unknown render/)
  })

  it('escapes HTML in a value like every other text', () => {
    const rows = sheetRows([{ key: 'name' }], { text: { name: '<b>bold</b>' } })
    expect(rows[0].html).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })
})
