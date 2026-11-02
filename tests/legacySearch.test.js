import { beforeAll, describe, expect, it } from 'vitest'
import { collate, entityRef, loadEntities, useDataPackage, useLegacySearch } from '../src/index.js'

const ids = (list) => list.map((r) => r.id)

beforeAll(async () => {
  await loadEntities(['objects', 'countries', 'glossary'])
  const { loadTranslations } = useDataPackage()
  for (const entity of ['objects', 'countries', 'glossary']) {
    await loadTranslations(entity, 'en')
    await loadTranslations(entity, 'fr')
  }
})

const fields = {
  keyword: (record, text) => [text.name, text.description, text.type],
  name: (record, text) => text.name,
}

const search = (options = {}) =>
  useLegacySearch({ entity: 'objects', fields, countryFields: ['keyword'], glossaryFields: ['keyword'], ...options })

const run = (narrow, filters, locale = 'en') => ids(narrow(entityRef('objects').value, filters, { locale }))

describe('collate', () => {
  it('compares as utf8_general_ci did: no case, no accents on a Latin letter, dotless ı as i', () => {
    expect(collate('Céramique')).toBe('ceramique')
    expect(collate('kazandıran')).toContain('iran')
    expect(collate('İznik')).toBe('iznik')
  })

  it('keeps the marks of other scripts, which the collation weighed', () => {
    expect(collate('ذَهَب')).not.toBe(collate('ذهب'))
    expect(collate('أحمد')).not.toBe(collate('احمد'))
  })
})

describe('the legacy Database search', () => {
  it('finds a record through any of its translations when no search language is chosen', () => {
    const { narrow } = search()
    expect(run(narrow, { q: 'carreau' })).toEqual(['o4'])
    expect(run(narrow, { q: 'iznik tile' })).toEqual(['o4'])
  })

  it('searches only the chosen search language', () => {
    const { narrow } = search()
    expect(run(narrow, { q: 'carreau', searchlanguage: 'fr' })).toEqual(['o4'])
    expect(run(narrow, { q: 'iznik tile', searchlanguage: 'fr' })).toEqual([])
  })

  it('matches all the rows within one translation, as legacy’s one row per language', () => {
    const { narrow } = search({ glossaryFields: [] })
    expect(run(narrow, { q: 'glazed', q2: 'coufique', op2: 'AND' })).toEqual([])
    expect(run(narrow, { q: 'bol', q2: 'coufique', op2: 'AND' })).toEqual(['o1'])
    expect(run(narrow, { q: 'glazed', q2: 'coufique', op2: 'OR' })).toEqual(['o1'])
  })

  it('ignores case and accents', () => {
    const { narrow } = search()
    expect(run(narrow, { q: 'GLACURE' })).toEqual(['o1'])
  })

  it('finds the records of a country any of whose names holds the word, in the fields that say so', () => {
    const { narrow } = search()
    expect(run(narrow, { q: 'gypt' })).toEqual(['o3', 'o1'])
    expect(run(narrow, { q: 'gypt', field: 'name' })).toEqual([])
  })

  it('searches a glossary term’s spellings in the language the site is read in', () => {
    const { narrow } = search()
    expect(run(narrow, { q: 'coufique' }, 'en')).toEqual(['o3', 'o1'])
    expect(run(narrow, { q: 'coufique' }, 'fr')).toEqual(['o1'])
  })

  it('orders the most relevant first, then by start date, an undated record first', () => {
    const { narrow } = search({ score: { keyword: (like, record, text) => (like(text.name) ? 1 : 0) } })
    expect(run(narrow, { q: 'c' })).toEqual(['o1', 'o4', 'o3', 'o2'])
  })

  it('is ready once every translation it reads has loaded', async () => {
    const { prepare, ready } = search()
    expect(ready.value).toBe(false)
    await prepare()
    expect(ready.value).toBe(true)
  })

  it("hands a field and a score the translation's language, to read a related record's text in it", () => {
    const seen = new Set()
    const { narrow } = search({
      fields: { keyword: (record, text, language) => (language === 'fr' ? [text.name] : []) },
      score: { keyword: (like, record, text, inCountry, language) => (seen.add(language), 0) },
    })
    expect(run(narrow, { q: 'carreau' })).toEqual(['o4'])
    expect(run(narrow, { q: 'iznik tile' })).toEqual([])
    expect([...seen].sort()).toEqual(['en', 'fr'])
  })

  it('keeps every record of the list, by start date, with no keyword', () => {
    const { narrow } = search()
    expect(run(narrow, {})).toEqual(['o3', 'o1', 'o2', 'o4'])
  })
})
