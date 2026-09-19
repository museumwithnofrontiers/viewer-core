import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStandardViewer } from '../src/index.js'
import { messages } from './fixtures/messages.js'

const FakeShell = defineComponent({
  name: 'FakeShell',
  props: {
    language: { type: String, default: '' },
    languages: { type: Array, default: () => [] },
    headerTitle: { type: String, default: '' },
  },
  emits: ['update:language'],
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fake-shell' }, [
        h('p', { class: 'fake-shell__title' }, props.headerTitle),
        slots.default?.(),
      ])
  },
})

const config = {
  datasetPackage: '@museumwnf/fixture-data',
  siteName: 'Fixture Museum',
  features: { entities: ['things'] },
}

// A family dictionary and a website's own overload, kept separate the way a
// real `@museumwnf/viewer-i18n/<family>` import and a `locales/*.json` glob
// are: the merge is this helper's job, not the fixture's.
const dictionary = {
  en: { 'core.nav.home': 'Home', 'core.status.loading': 'Loading…' },
}
const ownMessages = {
  en: { 'core.nav.home': 'Welcome' }, // local wins over the shared dictionary
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  window.location.hash = '#/'
})

describe('createStandardViewer', () => {
  it('builds, mounts and returns the app', async () => {
    const host = document.createElement('div')
    host.id = 'app'
    document.body.appendChild(host)

    const app = createStandardViewer({ ...config, messages }, undefined, { el: host })
    await app.config.globalProperties.$router.isReady()

    expect(host.innerHTML).toContain('Fixture Museum')
    app.unmount()
  })

  it('mounts to "#app" by default, like every website\'s main.js', async () => {
    const host = document.createElement('div')
    host.id = 'app'
    document.body.appendChild(host)

    const app = createStandardViewer({ ...config, messages })
    await app.config.globalProperties.$router.isReady()

    expect(host.innerHTML).toContain('Fixture Museum')
    app.unmount()
  })

  it('uses siteClass as config.shell when the config sets none', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const app = createStandardViewer({ ...config, messages }, FakeShell, { el: host })
    await app.config.globalProperties.$router.isReady()

    expect(host.querySelector('.fake-shell')).not.toBeNull()
    expect(host.innerHTML).toContain('Fixture Museum')
    app.unmount()
  })

  it('keeps an existing config.shell over siteClass', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const OtherShell = defineComponent({
      setup(_, { slots }) {
        return () => h('div', { class: 'other-shell' }, slots.default?.())
      },
    })

    const app = createStandardViewer({ ...config, messages, shell: OtherShell }, FakeShell, { el: host })
    await app.config.globalProperties.$router.isReady()

    expect(host.querySelector('.other-shell')).not.toBeNull()
    expect(host.querySelector('.fake-shell')).toBeNull()
    app.unmount()
  })

  it('merges a dictionary and the website\'s own messages, local wins', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const app = createStandardViewer({ ...config }, FakeShell, { el: host, dictionary, ownMessages })
    await app.config.globalProperties.$router.isReady()

    // FakeShell's headerTitle prop is untouched by messages; assert the
    // merge through the loading text instead, which core.status.loading
    // renders straight from the merged catalogue before the router settles.
    expect(app.config.globalProperties.$t('core.nav.home')).toBe('Welcome')
    expect(app.config.globalProperties.$t('core.status.loading')).toBe('Loading…')
    app.unmount()
  })

  it('falls back to config.messages when no dictionary is given', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const app = createStandardViewer({ ...config, messages }, undefined, { el: host })
    await app.config.globalProperties.$router.isReady()

    expect(app.config.globalProperties.$t('core.nav.home')).toBe('Home')
    app.unmount()
  })
})
