import { defineComponent, createApp, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { createI18n, mergeMessages, useI18n } from '../src/i18n/index.js'
import { renderBlock, renderInline } from '../src/i18n/markdown.js'
import I18nText from '../src/i18n/I18nText.vue'

function mount(component, i18n) {
  const app = createApp(component)
  if (i18n) app.use(i18n)
  const host = document.createElement('div')
  app.mount(host)
  return { app, host }
}

describe('createI18n', () => {
  const messages = {
    en: { 'core.nav.home': 'Home', 'core.nav.backToList': 'Back to the list' },
    fr: { 'core.nav.home': 'Accueil' },
  }

  it('reads the active language', () => {
    const i18n = createI18n({ messages, locale: 'fr' })
    expect(i18n.t('core.nav.home')).toBe('Accueil')
  })

  it('falls back to English for an entry the language does not have', () => {
    const i18n = createI18n({ messages, locale: 'fr' })
    expect(i18n.t('core.nav.backToList')).toBe('Back to the list')
  })

  it('returns the name itself when no language has the entry', () => {
    const i18n = createI18n({ messages })
    expect(i18n.t('core.nav.missing')).toBe('core.nav.missing')
  })

  it('follows the locale when it changes', () => {
    const i18n = createI18n({ messages })
    expect(i18n.t('core.nav.home')).toBe('Home')
    i18n.locale.value = 'fr'
    expect(i18n.t('core.nav.home')).toBe('Accueil')
  })

  it('provides $t to templates and useI18n() to scripts', () => {
    const i18n = createI18n({ messages })
    const Probe = defineComponent({
      setup() {
        const { t } = useI18n()
        return () => h('p', {}, t('core.nav.home'))
      },
    })
    const { app, host } = mount(Probe, i18n)
    expect(host.textContent).toBe('Home')
    app.unmount()
  })

  it('says so when a component is mounted without texts', () => {
    const Probe = defineComponent({ setup: () => (useI18n(), () => h('p')) })
    expect(() => mount(Probe)).toThrow(/has no texts installed/)
  })
})

describe('mergeMessages', () => {
  it('lets the local catalogue win, entry by entry', () => {
    const merged = mergeMessages(
      { en: { 'gallery.sheet.name': 'Name of Object:', 'gallery.nav.glossary': 'Glossary' } },
      { en: { 'gallery.sheet.name': 'Name of Carpet:' } }
    )
    expect(merged.en['gallery.sheet.name']).toBe('Name of Carpet:')
    expect(merged.en['gallery.nav.glossary']).toBe('Glossary')
  })

  it('keeps languages that appear in only one catalogue', () => {
    const merged = mergeMessages({ en: { a: '1' } }, { fr: { a: '2' } })
    expect(Object.keys(merged).sort()).toEqual(['en', 'fr'])
  })
})

describe('the Markdown pipeline', () => {
  it('renders Markdown', () => {
    expect(renderBlock('A **bold** word.')).toContain('<strong>bold</strong>')
    expect(renderBlock('One.\n\nTwo.')).toContain('<p>Two.</p>')
  })

  it('renders inline Markdown without the surrounding paragraph', () => {
    expect(renderInline('A **bold** word.')).toBe('A <strong>bold</strong> word.')
  })

  it('escapes raw HTML instead of rendering it', () => {
    const html = renderBlock('Hello <script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes raw HTML in a record field too, where the legacy content is', () => {
    // The importer converts legacy HTML to Markdown on the way in, so a tag
    // here means that conversion missed a field. Showing it is how it gets
    // noticed and fixed upstream; rendering it would hide it, and would trust
    // a museum record with markup.
    const html = renderBlock('An <i>italic</i> title.', { breaks: true })
    expect(html).toContain('&lt;i&gt;')
    expect(html).not.toContain('<i>')
  })

  it('escapes raw HTML in a record field even when a glossary is given', () => {
    // The escape guarantee does not move for the glossary pipeline — it is a
    // second Marked instance, not a second set of rules.
    const glossary = [{ id: 'g-1', spelling: 'mithqal' }]
    const html = renderBlock('An <i>italic</i> mithqal.', { breaks: true, glossary })
    expect(html).toContain('&lt;i&gt;')
    expect(html).not.toContain('<i>')
    expect(html).toContain('<span class="gloss-term" data-gid="g-1">mithqal</span>')
  })

  it('keeps a single newline as a line break only for a record', () => {
    expect(renderBlock('One\nTwo', { breaks: true })).toContain('<br>')
    expect(renderBlock('One\nTwo')).not.toContain('<br>')
  })

  it('renders a text through the I18nText component', () => {
    const i18n = createI18n({ messages: { en: { 'core.about.body': 'A **bold** claim.' } } })
    const Probe = defineComponent({
      setup: () => () => h(I18nText, { keypath: 'core.about.body' }),
    })
    const { app, host } = mount(Probe, i18n)
    expect(host.innerHTML).toContain('<strong>bold</strong>')
    app.unmount()
  })
})

describe('glossary highlighting', () => {
  // The exact case from metanull/viewer-core#30: the legacy site shows a
  // clickable highlight, the record itself has never contained the span —
  // it is built here, as a token the parser produces, not HTML smuggled
  // through the source (which the escaping above still rejects on sight).
  const glossary = [
    { id: 'g-mithqal', spelling: 'mithqal' },
    { id: 'g-kufic', spelling: 'kufic' },
    { id: 'g-kufic-script', spelling: 'kufic script' },
  ]

  it('highlights a term inside emphasis, and the emphasis survives', () => {
    const html = renderInline('An early *mithqal* weight.', { glossary })
    expect(html).toBe(
      'An early <em><span class="gloss-term" data-gid="g-mithqal">mithqal</span></em> weight.'
    )
  })

  it('matches case-insensitively and only whole words', () => {
    const html = renderInline('A Mithqal, not a mithqals.', { glossary })
    expect(html).toContain('<span class="gloss-term" data-gid="g-mithqal">Mithqal</span>')
    // "mithqals" contains the spelling but is not the whole word.
    expect(html).not.toContain('data-gid="g-mithqal">mithqals')
  })

  it('prefers the longest spelling when one contains another', () => {
    const html = renderInline('Written in kufic script here.', { glossary })
    expect(html).toContain('<span class="gloss-term" data-gid="g-kufic-script">kufic script</span>')
    expect(html).not.toContain('data-gid="g-kufic">')
  })

  // A backtick is a letter on these sites, never a code marker, so a term
  // between two of them is a term like any other.
  it('highlights a term between backticks, which are letters here', () => {
    const html = renderInline('See `mithqal` in the source.', { glossary })
    expect(html).not.toContain('<code>')
    expect(html).toContain('`<span class="gloss-term" data-gid="g-mithqal">mithqal</span>`')
  })

  it('leaves a term alone inside a link destination', () => {
    const html = renderInline('[a weight](https://example.com/mithqal)', { glossary })
    expect(html).toContain('href="https://example.com/mithqal"')
    expect(html).not.toContain('gloss-term')
  })

  it('still produces <br> for a record with breaks: true', () => {
    const html = renderBlock('A mithqal.\nAnother line.', { breaks: true, glossary })
    expect(html).toContain('<br>')
    expect(html).toContain('gloss-term')
  })

  it('renderInline yields no surrounding <p>', () => {
    const html = renderInline('A mithqal.', { glossary })
    expect(html).not.toContain('<p>')
  })

  it('does nothing when no spelling in the text matches', () => {
    const html = renderInline('Nothing glossary-worthy here.', { glossary })
    expect(html).not.toContain('gloss-term')
  })

  it('does nothing when the glossary list is empty', () => {
    const html = renderInline('A mithqal.', { glossary: [] })
    expect(html).not.toContain('gloss-term')
  })
})
