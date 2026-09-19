import { describe, expect, it } from 'vitest'
import { useDataPackage } from '../src/index.js'

describe('useDataPackage', () => {
  it('exposes the manifest and language list', () => {
    const { manifest, languages } = useDataPackage()
    expect(manifest.dataset).toBe('fixture')
    expect(languages).toEqual(['en', 'fr', 'de'])
  })

  it('lists entities without the manifest or npm metadata', () => {
    const { entityNames } = useDataPackage()
    // The fixture directory contains package.json, like every installed
    // npm package — it must not surface as an entity. `dynasties`,
    // `exhibition`, `gallery`, `items` and `tags` were added for the DXA
    // composables' own fixtures (tests/dxa/).
    expect(entityNames).toEqual([
      'collections', 'countries', 'dynasties', 'exhibition', 'gallery', 'glossary',
      'items', 'objects', 'partners', 'places', 'tags', 'things', 'timeline_events', 'timelines',
    ])
  })

  it('lazy-loads entity records', async () => {
    const { loadEntity } = useDataPackage()
    const things = await loadEntity('things')
    expect(things).toHaveLength(3)
    expect(things[0].id).toBe('1')
  })

  it('rejects unknown entities', async () => {
    const { loadEntity } = useDataPackage()
    await expect(loadEntity('nope')).rejects.toThrow('Unknown entity')
  })
})

describe('useDataPackage translations', () => {
  it('lists the languages a translations file actually exists for', () => {
    const { availableLanguages } = useDataPackage()
    expect(availableLanguages('things')).toEqual(['en', 'fr'])
    expect(availableLanguages('nope')).toEqual([])
  })

  it('reads nothing before loadTranslations resolves', () => {
    const { translations, tr } = useDataPackage()
    expect(translations('things', 'de')).toEqual({})
    expect(tr('things', '1', 'de')).toEqual({})
  })

  it('lazy-loads one language of one entity, by name — never by an interpolated import', async () => {
    const { loadTranslations, translations } = useDataPackage()
    const loaded = await loadTranslations('things', 'en')
    expect(loaded).toEqual({
      1: { title: 'First Thing (EN)' },
      2: { title: 'Second Thing (EN)' },
    })
    // Cached: a second read (via a fresh useDataPackage() call, since the
    // cache is a module-level singleton) sees it without loading again.
    expect(useDataPackage().translations('things', 'en')).toEqual(loaded)
  })

  it('resolves a record and falls back to fallbackLang, then to {}', async () => {
    const { loadTranslations, tr } = useDataPackage()
    await loadTranslations('things', 'en')
    await loadTranslations('things', 'fr')

    expect(tr('things', '1', 'fr')).toEqual({ title: 'Première chose (FR)' })
    // id 2 has no French row — falls back to English.
    expect(tr('things', '2', 'fr')).toEqual({ title: 'Second Thing (EN)' })
    // Unknown id in either language — falls back to {}.
    expect(tr('things', '99', 'fr')).toEqual({})
  })

  it('resolves to {} for a language with no file at all, without throwing', async () => {
    const { loadTranslations, translations } = useDataPackage()
    await expect(loadTranslations('things', 'de')).resolves.toEqual({})
    expect(translations('things', 'de')).toEqual({})
  })
})
