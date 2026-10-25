import { describe, expect, it } from 'vitest'
import { glossaryIdsIn } from '../src/i18n/markdown.js'
import { md, mdInline, mdStrip, renderBlock, renderInline, renderPlain } from '../src/index.js'

// A data package holds Markdown, and the importer is what converts the legacy
// HTML on the way in. These are the only places a text becomes HTML on any
// website, so this is where that stays true: a tag that slipped past the
// importer must appear on the page as the characters it is, never as markup.

describe('rendering a record field', () => {
  it('renders Markdown', () => {
    expect(renderBlock('A **bold** claim.')).toContain('<strong>bold</strong>')
    expect(renderInline('A **bold** claim.')).toBe('A <strong>bold</strong> claim.')
  })

  it('keeps a line break, which a record types on purpose', () => {
    expect(renderBlock('One\nTwo', { breaks: true })).toContain('<br>')
  })

  it('escapes HTML instead of rendering it', () => {
    expect(renderBlock('An <i>italic</i> title.')).toContain('&lt;i&gt;')
    expect(renderBlock('An <i>italic</i> title.')).not.toContain('<i>')
    expect(renderInline('An <i>italic</i> title.')).not.toContain('<i>')
    expect(renderBlock('<script>alert(1)</script>')).not.toContain('<script>')
  })

  it('drops markup entirely where the text has to be plain', () => {
    expect(renderPlain('An *italic* title.')).toBe('An italic title.')
    expect(renderPlain('An <i>italic</i> title.')).not.toContain('<i>')
  })

  // Legacy writes the ʿayn as a backtick; no text on these sites is code.
  it('prints backticks as the letters they are, never as a code span', () => {
    const text = 'Khedive `Abbas Hilmi II, then King Fu`ad I.'
    expect(renderInline(text)).toBe('Khedive `Abbas Hilmi II, then King Fu`ad I.')
    expect(renderBlock(text, { breaks: true })).not.toContain('<code>')
    expect(md('A `b` c', { glossary: [{ id: 'g1', spelling: 'c' }] })).not.toContain('<code>')
    expect(renderInline('Fu\\`ad')).toBe('Fu`ad')
    expect(renderPlain(text)).toBe(text)
  })

  it('still escapes a tag that sits between two backticks', () => {
    const html = renderBlock('Muhammad V.<br/> However, `Abbas', { breaks: true })
    expect(html).not.toContain('<code>')
    expect(html).toContain('&lt;br/&gt;')
  })

  it('reads an indented line as a line of its paragraph, not a code block', () => {
    expect(renderBlock('First line\n\n    indented line')).not.toContain('<pre>')
    expect(renderBlock('```\nfenced\n```')).not.toContain('<pre>')
  })
})

describe('renderPlain', () => {
  it('reads a heading, a list and a paragraph as one line', () => {
    expect(renderPlain('# Title\n\n- one\n- two\n\nBody **text**.')).toBe('Title one two Body text.')
  })

  it('turns an image into its alt text and a link into its text', () => {
    expect(renderPlain('See ![a bowl](bowl.jpg) at [the museum](https://example.org).')).toBe(
      'See a bowl at the museum.',
    )
  })

  it('turns a line break into a space', () => {
    expect(renderPlain('One\nTwo')).toBe('One Two')
    expect(renderPlain('One  \nTwo')).toBe('One Two')
  })

  it('decodes an entity the author wrote', () => {
    expect(renderPlain('Salt &amp; pepper &#233;')).toBe('Salt & pepper é')
  })

  it('drops raw tags rather than escaping or rendering them', () => {
    expect(renderPlain('A <b>bold</b> claim')).toBe('A bold claim')
    expect(renderPlain('<script>alert(1)</script>')).not.toContain('<')
  })

  it('reads nothing as nothing', () => {
    expect(renderPlain(null)).toBe('')
    expect(renderPlain('')).toBe('')
  })
})

// `md`/`mdInline`/`mdStrip` are what all seven sites wrote for themselves,
// with two incompatible signatures between them (`md(text, glossary)` and
// `md(text, { glossary })`). This is the one signature.
describe('md / mdInline / mdStrip', () => {
  it('keep a record’s line breaks by default, unlike renderBlock', () => {
    expect(md('One\nTwo')).toContain('<br>')
    expect(renderBlock('One\nTwo')).not.toContain('<br>')
  })

  it('let a caller ask for prose breaks instead', () => {
    expect(md('One\nTwo', { breaks: false })).not.toContain('<br>')
  })

  it('highlight a glossary the same way renderBlock/renderInline do', () => {
    const glossary = [{ id: 'g1', spelling: 'kufic' }]
    expect(md('A kufic bowl.', { glossary })).toContain('<span class="gloss-term" data-gid="g1">kufic</span>')
    expect(mdInline('A kufic bowl.', { glossary })).toContain('<span class="gloss-term" data-gid="g1">kufic</span>')
  })

  it('strip markup the same way renderPlain does', () => {
    expect(mdStrip('An *italic* title.')).toBe('An italic title.')
  })

  it('read a missing text as "", not as an empty paragraph', () => {
    expect(md(null)).toBe('')
    expect(md('')).toBe('')
    expect(mdInline(undefined)).toBe('')
    expect(mdStrip(null)).toBe('')
  })
})

describe('glossaryIdsIn', () => {
  const glossary = [
    { id: 'g1', spelling: 'kufic' },
    { id: 'g1', spelling: 'kufic script' },
    { id: 'g2', spelling: 'glaze' },
  ]

  it('finds every term whose spelling occurs in the text, once each', () => {
    expect(glossaryIdsIn('A pot with a fine glaze, in kufic script.', glossary).sort()).toEqual(['g1', 'g2'])
    expect(glossaryIdsIn('kufic, kufic, kufic', glossary)).toEqual(['g1'])
  })

  it('matches whole words only, case-insensitively', () => {
    expect(glossaryIdsIn('unkuficlike', glossary)).toEqual([])
    expect(glossaryIdsIn('A KUFIC bowl.', glossary)).toEqual(['g1'])
  })

  it('is nothing for an empty text or an empty glossary', () => {
    expect(glossaryIdsIn('', glossary)).toEqual([])
    expect(glossaryIdsIn('kufic', [])).toEqual([])
    expect(glossaryIdsIn('kufic', null)).toEqual([])
  })
})
