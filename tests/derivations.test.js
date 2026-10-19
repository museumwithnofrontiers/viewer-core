import { beforeAll, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import {
  artistLine, citation, loadEntities, relatedRecords, removeEndingPoint, searchGlossary, sheetRows, timelineLinkFor,
  useDataPackage, useGlossaryPopup, useRelatedRecords,
} from '../src/index.js'

beforeAll(async () => {
  await loadEntities(['objects', 'glossary'])
  const { loadTranslations } = useDataPackage()
  await loadTranslations('glossary', 'en')
  await loadTranslations('glossary', 'fr')
})

describe('useGlossaryPopup', () => {
  const entries = [{ id: 'g1', spelling: 'kufic', word: 'kufic', definition: 'An angular script.' }]

  it('answers a click on a rendered term with the term, and nothing to any other click', () => {
    const { active, onClick, close } = useGlossaryPopup(entries)
    const container = document.createElement('div')
    container.innerHTML = 'in <span class="gloss-term" data-gid="g1">Kufic</span> script <em>x</em>'
    const term = container.querySelector('.gloss-term')
    let prevented = false
    onClick({ target: term, preventDefault: () => { prevented = true } })
    expect(prevented).toBe(true)
    expect(active.value).toEqual({ id: 'g1', spelling: 'Kufic', word: 'kufic', definition: 'An angular script.' })
    close()
    expect(active.value).toBeNull()
    onClick({ target: container.querySelector('em'), preventDefault: () => { prevented = false } })
    expect(active.value).toBeNull()
  })
})

describe('searchGlossary', () => {
  it('finds the terms whose spelling starts with the input, in the language asked', () => {
    expect(searchGlossary('kuf', 'en').map((h) => h.spelling)).toEqual(['kufic'])
    expect(searchGlossary('cou', 'fr').map((h) => h.id)).toEqual(['g1'])
    // g2 has no French row and is found through its English spellings.
    expect(searchGlossary('gla', 'fr').map((h) => h.id)).toEqual(['g2'])
    expect(searchGlossary('', 'en')).toEqual([])
  })
})

describe('citation', () => {
  it('assembles the sentence from parts, in order', () => {
    expect(
      citation({ author: 'A. Author', name: 'Glazed *bowl*', project: 'Discover Islamic Art', year: 2026, permalink: 'https://x/#/item/o1', inWord: 'dans' }),
    ).toBe('A. Author "Glazed bowl" dans Discover Islamic Art, Museum With No Frontiers, 2026. https://x/#/item/o1')
  })

  it('leaves missing parts out, and says nothing for a record without a name', () => {
    expect(citation({ name: 'Lamp', project: '', publisher: 'MWNF', year: 2000 })).toBe('"Lamp" in MWNF, 2000.')
    expect(citation({ name: '' })).toBe('')
  })
})

describe('relatedRecords', () => {
  it('splits references by whether the package carries them, with the justification in the language asked', () => {
    const o1 = { id: 'o1', related_items: [
      { id: 'o2', in_package: true, justifications: { en: 'Same workshop', fr: 'Même atelier' } },
      { id: 'x9', in_package: false, backward_compatibility: 'mwnf3:objects:x9' },
      { id: 'o2', in_package: true },
    ] }
    const { inPackage, outside } = relatedRecords(o1, { entity: 'objects', language: 'fr' })
    expect(inPackage).toHaveLength(1)
    expect(inPackage[0].record.internal_name).toBe('Lamp')
    expect(inPackage[0].justification).toBe('Même atelier')
    expect(outside.map((r) => r.id)).toEqual(['x9'])
    expect(relatedRecords(o1, { entity: 'objects', language: 'de' }).inPackage[0].justification).toBe('Same workshop')
  })

  it('treats a reference the package does not hold as outside, whatever it claims', () => {
    const { outside } = relatedRecords({ related_items: [{ id: 'ghost', in_package: true }] }, { entity: 'objects' })
    expect(outside.map((r) => r.id)).toEqual(['ghost'])
  })

  it('follows its sources', () => {
    const record = ref({ related_items: [{ id: 'o2', justifications: { fr: 'FR' } }] })
    const language = ref('fr')
    const related = useRelatedRecords(record, { entity: 'objects', language })
    expect(related.value.inPackage[0].justification).toBe('FR')
    language.value = 'en'
    expect(related.value.inPackage[0].justification).toBe('')
  })
})

describe('timelineLinkFor', () => {
  it('points at the timeline results for the record’s country and dates', () => {
    expect(timelineLinkFor({ country_id: 'c-eg', start_date: 900, end_date: 950 })).toEqual({
      name: 'timeline-results',
      query: { country: 'c-eg', begin: '900', end: '950' },
    })
  })

  it('takes the site’s route name, query keys and country value, and rounds when asked', () => {
    const link = timelineLinkFor(
      { country_id: 'c-eg', start_date: 1193 },
      { name: 'timeline', keys: { country: 'c', begin: 'start', end: 'end' }, country: () => 'eg', round: true },
    )
    expect(link).toEqual({ name: 'timeline', query: { c: 'eg', start: '1100', end: '1200' } })
  })

  it('is nothing for a record with neither country nor date', () => {
    expect(timelineLinkFor({ id: 'x' })).toBeNull()
    expect(timelineLinkFor(null)).toBeNull()
  })
})

describe('removeEndingPoint', () => {
  it('drops the periods that end a text, sparing one after C, as in B.C.', () => {
    expect(removeEndingPoint('Umayyad period. ')).toBe('Umayyad period')
    expect(removeEndingPoint('100 B.C.')).toBe('100 B.C.')
    expect(removeEndingPoint('No period')).toBe('No period')
    expect(removeEndingPoint(null)).toBe('')
  })

  it("answers as legacy's regex did at the edges", () => {
    // What /([^C])\.+[[:space:]]*$/ → "$1" gives in PHP.
    expect(removeEndingPoint('B.C..')).toBe('B.C.')
    expect(removeEndingPoint('...')).toBe('.')
    expect(removeEndingPoint('.')).toBe('.')
    expect(removeEndingPoint('Ottoman.\n')).toBe('Ottoman')
    expect(removeEndingPoint('No period ')).toBe('No period ')
  })

  it('stays linear on a long run of periods', () => {
    const text = `B${'.'.repeat(100000)}x`
    expect(removeEndingPoint(text)).toBe(text)
  })
})

describe('artistLine', () => {
  const life = {
    artist_birthdate: '1660', artist_birthplace: 'Chemnitz', artist_deathdate: '1736', artist_deathplace: 'Augsburg',
  }

  it('brackets the life data on the artist line, as database_item.php did', () => {
    expect(artistLine('Andreas Matthäus', life)).toBe('Andreas Matthäus (1660, Chemnitz-1736, Augsburg)')
    expect(artistLine('A', { artist_birthdate: '1660', artist_deathdate: '1736' })).toBe('A (1660-1736)')
    // Legacy's own joins: a missing birth date keeps the comma before the place.
    expect(artistLine('A', { artist_birthplace: 'Chemnitz' })).toBe('A (, Chemnitz)')
  })

  it('prints nothing bracketed without an artist, and the artist alone without life data', () => {
    expect(artistLine('', life)).toBe('')
    expect(artistLine('A', {})).toBe('A')
    expect(artistLine('A', undefined)).toBe('A')
  })

  it('puts the life data on a line of its own, as the DXA sheets did', () => {
    expect(artistLine('A', life, { style: 'line' })).toBe('A  \n1660, Chemnitz - 1736, Augsburg')
    expect(artistLine('A', { artist_deathplace: 'Augsburg' }, { style: 'line' })).toBe('A  \nAugsburg')
    expect(artistLine('', { artist_birthdate: '1660' }, { style: 'line' })).toBe('1660')
    expect(artistLine('A', { artist_birthdate: ' ' }, { style: 'line' })).toBe('A')
  })

  it('renders the line break as one through the sheet engine', () => {
    const [row] = sheetRows([{ key: 'artist', value: (c) => artistLine('A', c.text, { style: 'line' }) }], { text: life })
    expect(row.html).toBe('A<br>1660, Chemnitz - 1736, Augsburg')
  })
})
