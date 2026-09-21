import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as core from '../src/index.js'
import {
  createI18n, loadEntities, mwnfLinks, projectLabel,
  projectLinks, sectionMeta, useFeaturedRecord, useProjects, useSection,
} from '../src/index.js'

describe('the legacy project API (removed in 2.0.0)', () => {
  it('is not exported from the package entry, so a re-export by mistake fails loudly', () => {
    expect(core).not.toHaveProperty('PROJECT_ENTRIES')
    expect(core).not.toHaveProperty('PROJECT_FAMILIES')
    expect(core).not.toHaveProperty('projectName')
    expect(core).not.toHaveProperty('useProjectName')
    expect(core).not.toHaveProperty('projectFamily')
  })
})

// Epic metanull/inventory-app#1727: `manifest.projects`.
describe('projectLabel', () => {
  const manifest = {
    projects: {
      'proj-islamicart': {
        name: { en: 'Discover Islamic Art', fr: 'Découvrir l’art islamique' },
        site_url: 'https://islamicart.museumwnf.org',
        related_database_url: null,
        artistic_introduction_url: 'https://islamicart.museumwnf.org/gai/ISL/',
      },
      'proj-french-only': {
        name: { fr: 'Nom en français seulement' },
        site_url: null,
        related_database_url: null,
        artistic_introduction_url: null,
      },
    },
  }

  it('reads the name in the requested language', () => {
    expect(projectLabel(manifest, 'proj-islamicart', 'fr')).toBe('Découvrir l’art islamique')
  })

  it('falls back to en, then to the entry\'s first carried language — resolveRecordLanguage\'s own rule', () => {
    expect(projectLabel(manifest, 'proj-islamicart', 'de')).toBe('Discover Islamic Art')
    expect(projectLabel(manifest, 'proj-french-only', 'de')).toBe('Nom en français seulement')
  })

  it('answers null, never throws, for an unknown project id', () => {
    expect(projectLabel(manifest, 'nope', 'en')).toBeNull()
    expect(projectLabel(manifest, undefined, 'en')).toBeNull()
  })

  it('answers null, never throws, when the package predates manifest.projects entirely', () => {
    expect(projectLabel({}, 'proj-islamicart', 'en')).toBeNull()
    expect(projectLabel(undefined, 'proj-islamicart', 'en')).toBeNull()
  })

  it('answers null for an entry that names nothing at all', () => {
    expect(projectLabel({ projects: { p: { name: {} } } }, 'p', 'en')).toBeNull()
    expect(projectLabel({ projects: { p: {} } }, 'p', 'en')).toBeNull()
  })
})

describe('projectLinks', () => {
  const manifest = {
    projects: {
      'proj-a': {
        name: { en: 'A' },
        site_url: 'https://a.example.org',
        related_database_url: 'https://a.example.org/database.php',
        artistic_introduction_url: null,
      },
    },
  }

  it('reads the three URLs the entry carries', () => {
    expect(projectLinks(manifest, 'proj-a')).toEqual({
      siteUrl: 'https://a.example.org',
      relatedDatabaseUrl: 'https://a.example.org/database.php',
      artisticIntroductionUrl: null,
    })
  })

  it('answers null, never throws, for an unknown project id or an absent projects section', () => {
    expect(projectLinks(manifest, 'nope')).toBeNull()
    expect(projectLinks({}, 'proj-a')).toBeNull()
    expect(projectLinks(undefined, 'proj-a')).toBeNull()
  })
})

describe('useProjects', () => {
  it('resolves against the installed data package and the active language, and answers null for a package built before this phase', () => {
    const i18n = createI18n({ messages: { en: {} }, locale: 'en' })
    let projects
    mount({ setup() { projects = useProjects(); return () => null } }, { global: { plugins: [i18n] } })
    // tests/fixtures/data-package/manifest.json predates epic #1727 phase 2
    // — it carries no `projects` key at all. Nothing throws; both helpers
    // read that the same way they read an unknown project id.
    expect(projects.label('anything')).toBeNull()
    expect(projects.links('anything')).toBeNull()
  })
})

describe('sectionMeta', () => {
  it('merges the chrome entities into every section, on top of the section\'s own', () => {
    const meta = sectionMeta(['gallery', 'items', 'partners', 'countries'])
    expect(meta('collection', 'tags')).toEqual({
      section: 'collection',
      entities: ['gallery', 'items', 'partners', 'countries', 'tags'],
    })
    expect(meta('home')).toEqual({ section: 'home', entities: ['gallery', 'items', 'partners', 'countries'] })
  })

  it('carries no chrome at all when none is named', () => {
    const meta = sectionMeta()
    expect(meta('database', 'languages')).toEqual({ section: 'database', entities: ['languages'] })
  })
})

describe('mwnfLinks', () => {
  it('is frozen, and carries the twelve addresses the DXA configs repeat', () => {
    expect(Object.isFrozen(mwnfLinks)).toBe(true)
    expect(mwnfLinks.portal).toBe('https://www.museumwnf.org')
    expect(mwnfLinks.islamicArt).toBe('https://islamicart.museumwnf.org')
    expect(Object.keys(mwnfLinks)).toHaveLength(12)
  })
})

describe('useSection', () => {
  it('reads the section a route declares, and nothing for one that does not', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<p />' } },
        { path: '/collection', name: 'collection', component: { template: '<p />' }, meta: { section: 'collection' } },
      ],
    })
    let section
    mount({ setup() { section = useSection(); return () => null } }, { global: { plugins: [router] } })
    expect(section.value).toBe('')
    await router.push('/collection')
    expect(section.value).toBe('collection')
  })
})

describe('useFeaturedRecord', () => {
  beforeAll(() => loadEntities(['objects']))

  it('picks among the records with an image, deterministically under a seed', () => {
    const first = useFeaturedRecord('objects', { seed: 7 })
    const again = useFeaturedRecord('objects', { seed: 7 })
    expect(first.value.images.length).toBeGreaterThan(0)
    expect(first.value.id).toBe(again.value.id)
    expect(['o1', 'o3', 'o4']).toContain(first.value.id)
  })

  it('picks among all when asked, and answers null for an entity not yet loaded', () => {
    const any = useFeaturedRecord('objects', { withImage: false, seed: 3 })
    expect(['o1', 'o2', 'o3', 'o4']).toContain(any.value.id)
    expect(useFeaturedRecord('places', { seed: 1 }).value).toBeNull()
  })
})
