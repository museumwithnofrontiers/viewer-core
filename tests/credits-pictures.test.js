import { describe, expect, it } from 'vitest'
import { creditLine, picturesInLanguage } from '../src/index.js'

// The galleries' sheet (dxa-api) printed each credited person as
// "Firstname LASTNAME" and listed a picture only where it had a row in the
// page's language.

describe('creditLine', () => {
  it('prints each person as the galleries did, the surname in capitals', () => {
    expect(creditLine([{ firstname: 'Najd', lastname: 'Sweidan' }, { firstname: 'Abd', lastname: 'al-Razzaq Moaz' }])).toBe(
      'Najd SWEIDAN, Abd AL-RAZZAQ MOAZ',
    )
  })

  it('prints a spelling of its own as written', () => {
    expect(creditLine([{ name: 'أنيت هاغِِدورن.' }])).toBe('أنيت هاغِِدورن.')
    expect(creditLine([{ name: 'MUSEUM Staff' }, { firstname: 'Layan', lastname: 'Shahin' }])).toBe('MUSEUM Staff, Layan SHAHIN')
  })

  it('prints nothing for no one', () => {
    expect(creditLine(undefined)).toBe('')
    expect(creditLine([])).toBe('')
  })
})

describe('picturesInLanguage', () => {
  const pictures = [
    { url: 'a.jpg', languages: ['en', 'fr'] },
    { url: 'b.jpg', languages: ['fr'] },
    { url: 'c.jpg', languages: [] },
  ]

  it('keeps the pictures with a row in the language', () => {
    expect(picturesInLanguage(pictures, 'en').map((p) => p.url)).toEqual(['a.jpg'])
    expect(picturesInLanguage(pictures, 'fr').map((p) => p.url)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('keeps every picture of a package that carries no languages', () => {
    expect(picturesInLanguage([{ url: 'a.jpg' }, { url: 'b.jpg' }], 'en')).toHaveLength(2)
    expect(picturesInLanguage(undefined, 'en')).toEqual([])
  })
})
