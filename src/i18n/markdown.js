import { Marked } from 'marked'

// One Markdown pipeline for every text on every website, configured here and
// nowhere else. Its own instance rather than the shared `marked` singleton, so
// configuring it cannot change how a website renders anything else.
//
// Raw HTML is escaped rather than rendered. Texts are written by translators
// through the GitHub web interface, and the rules they are given say Markdown
// only; escaping is what makes that a guarantee instead of a request.
//
// This is the only place that guarantee lives. viewer-i18n's checker used to
// reject HTML too, which added nothing here and was wrong about autolinks and
// code spans; it no longer looks. Anything relaxed in this file is relaxed
// everywhere, with nothing behind it.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ESCAPES[character])
}

// Raw HTML is escaped in both, because both render text that came from
// somewhere else: a translator's file, or a museum record carried in from the
// legacy system. Neither is a place markup may be authored.
const escaping = {
  renderer: {
    html(token) {
      return escapeHtml(token?.raw ?? token?.text ?? token ?? '')
    },
  },
}

// No text on these websites is code. Legacy wrote the backtick as a letter
// (the ʿayn of "Fu`ad", "`Abbas"), and a text pasted from a word processor can
// hold one anywhere; read as Markdown, two of them turned the words between
// into a code span, printed in a code font with any markup inside as
// characters. An indented line was a code block the same way. Without these
// three tokenizers a backtick is the character it is, and an indented line a
// line of its paragraph.
const noCode = {
  tokenizer: {
    codespan() {
      return undefined
    },
    code() {
      return undefined
    },
    fences() {
      return undefined
    },
  },
}

// `breaks` is the one difference, and it is a difference in the source rather
// than in policy. A text in the dictionary is written as prose and wraps freely,
// so a single newline means nothing. A record's field arrives from a database
// where a newline was typed to be a line break, and dropping it runs the lines
// together.
const prose = new Marked({ async: false, gfm: true, breaks: false })
const record = new Marked({ async: false, gfm: true, breaks: true })
prose.use(escaping, noCode)
record.use(escaping, noCode)

const pipeline = (breaks) => (breaks ? record : prose)

const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g
function escapeRegExp(text) {
  return text.replace(REGEXP_SPECIAL, '\\$&')
}

// A word boundary that also works for a spelling starting or ending in an
// accented letter — JS's own `\b` is `\w`-based (`[A-Za-z0-9_]`), so it does
// not see "é" as a word character and misses the boundary right before one.
const NOT_WORD = '[\\p{L}\\p{N}_]'

/**
 * A marked inline extension: highlights every occurrence of a glossary
 * spelling as `<span class="gloss-term" data-gid="…">`, as a token the
 * parser produces rather than HTML smuggled through the source text — the
 * escaping above still applies to everything else. One instance per
 * distinct glossary (see the cache below); built once, matched against
 * every text rendered with that glossary.
 */
function spellingIndex(glossary) {
  const bySpelling = new Map()
  for (const { id, spelling } of glossary) {
    const trimmed = spelling?.trim()
    if (!trimmed) continue
    bySpelling.set(trimmed.toLowerCase(), id)
  }

  // Longest spelling first, so "kufic script" wins over "kufic" when a text
  // contains both.
  const spellings = [...bySpelling.keys()].sort((a, b) => b.length - a.length)
  if (spellings.length === 0) return null
  return { bySpelling, alternation: spellings.map(escapeRegExp).join('|') }
}

function glossaryExtension(glossary) {
  const index = spellingIndex(glossary)
  if (!index) return null
  const { bySpelling, alternation } = index
  const findAnywhere = new RegExp(`(?<!${NOT_WORD})(?:${alternation})(?!${NOT_WORD})`, 'iu')
  const matchAtStart = new RegExp(`^(?:${alternation})(?!${NOT_WORD})`, 'iu')

  return {
    name: 'glossaryTerm',
    level: 'inline',
    start(src) {
      return findAnywhere.exec(src)?.index
    },
    tokenizer(src) {
      const match = matchAtStart.exec(src)
      if (!match) return undefined
      return {
        type: 'glossaryTerm',
        raw: match[0],
        text: match[0],
        id: bySpelling.get(match[0].toLowerCase()),
      }
    },
    renderer(token) {
      return `<span class="gloss-term" data-gid="${escapeHtml(token.id)}">${escapeHtml(token.text)}</span>`
    },
  }
}

// Keyed on the spelling list, not on which text is being rendered — every
// field of one record shares the same glossary, and re-parsing that list
// into a regex and a Marked instance for each field would be wasted work.
const glossaryPipelines = new Map()

function glossaryKey(glossary) {
  return JSON.stringify([...glossary].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
}

function withGlossary(breaks, glossary) {
  const key = glossaryKey(glossary)
  let entry = glossaryPipelines.get(key)
  if (entry === undefined) {
    const extension = glossaryExtension(glossary)
    if (!extension) {
      entry = null // no usable spelling in this list — fall back below
    } else {
      const withProse = new Marked({ async: false, gfm: true, breaks: false })
      const withRecord = new Marked({ async: false, gfm: true, breaks: true })
      withProse.use(escaping, noCode, { extensions: [extension] })
      withRecord.use(escaping, noCode, { extensions: [extension] })
      entry = { prose: withProse, record: withRecord }
    }
    glossaryPipelines.set(key, entry)
  }
  return entry ? (breaks ? entry.record : entry.prose) : pipeline(breaks)
}

function engineFor(breaks, glossary) {
  return glossary && glossary.length > 0 ? withGlossary(breaks, glossary) : pipeline(breaks)
}

// The same key as the render pipelines, for the same reason: a glossary list
// is rebuilt into a regex once, however many texts get scanned against it.
const glossaryMatchers = new Map()

function matcherFor(glossary) {
  const key = glossaryKey(glossary)
  let matcher = glossaryMatchers.get(key)
  if (matcher === undefined) {
    const index = spellingIndex(glossary)
    matcher = index
      ? { bySpelling: index.bySpelling, regex: new RegExp(`(?<!${NOT_WORD})(?:${index.alternation})(?!${NOT_WORD})`, 'giu') }
      : null
    glossaryMatchers.set(key, matcher)
  }
  return matcher
}

/**
 * The ids of `glossary` (`[{ id, spelling }]`) whose spelling occurs in
 * `text`, matched the same word-bounded, case-insensitive way
 * `renderBlock`/`renderInline` highlight them — a text scanned this way and
 * the same text rendered with the same list agree on what counts as a hit.
 * The free-text counterpart to a record's own `glossary_ids`: a dynasty
 * history or a theme essay has no such column to read, so this scans the
 * whole glossary against the text instead. One id per term, in no
 * particular order.
 */
export function glossaryIdsIn(text, glossary) {
  if (!glossary || glossary.length === 0) return []
  const matcher = matcherFor(glossary)
  if (!matcher) return []
  const found = new Set()
  for (const match of String(text ?? '').matchAll(matcher.regex)) {
    found.add(matcher.bySpelling.get(match[0].toLowerCase()))
  }
  return [...found]
}

/** A text as one or more paragraphs. `glossary`: `[{ id, spelling }]` to highlight. */
export function renderBlock(text, { breaks = false, glossary } = {}) {
  return engineFor(breaks, glossary).parse(String(text ?? ''))
}

/** A text without the surrounding paragraph, for a heading or a table cell. */
export function renderInline(text, { breaks = false, glossary } = {}) {
  return engineFor(breaks, glossary).parseInline(String(text ?? ''))
}

// Plain text is read off the token tree the same parser produces, never by
// rewriting the source with a regex: what a Markdown text says is what its
// tokens say. Raw HTML is dropped, since it was never content; an image is
// its alt text; a break is a space.
const BLOCKS = new Set(['paragraph', 'heading', 'blockquote', 'list', 'list_item', 'code', 'table', 'hr', 'html'])

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

function plainText(tokens) {
  let out = ''
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'html':
        break
      case 'image':
        out += token.text ?? ''
        break
      case 'br':
      case 'space':
        out += ' '
        break
      case 'list':
        out += plainText(token.items)
        break
      case 'table':
        out += plainText(token.header)
        for (const row of token.rows ?? []) out += plainText(row)
        break
      default:
        if (token.tokens?.length) out += plainText(token.tokens)
        else out += token.text ?? ''
    }
    if (BLOCKS.has(token.type)) out += ' '
  }
  return out
}

/** A text as plain text — for an `alt`, a `title`, an option label, a sort key. */
export function renderPlain(text) {
  return decodeEntities(plainText(record.lexer(String(text ?? ''))))
    .replace(/\s+/g, ' ')
    .trim()
}

// `md`/`mdInline`/`mdStrip` are `renderBlock`/`renderInline`/`renderPlain`
// under the one signature and the one convention every site wrote for
// itself: a missing text is `''`, not an empty paragraph or "undefined", and
// a record's own line breaks are kept unless a caller says otherwise — a
// data-package field is typed with breaks on purpose, the way a dictionary
// entry is not. `renderBlock`/`renderInline`/`renderPlain` stay, for a
// caller that wants the pipeline's own default (`breaks: false`) instead.

/** `renderBlock`, record convention: `''` for a missing text, line breaks kept by default. */
export function md(text, { glossary, breaks = true } = {}) {
  if (!text) return ''
  return renderBlock(text, { breaks, glossary })
}

/** `renderInline`, the same convention, for a heading or a table cell. */
export function mdInline(text, { glossary } = {}) {
  if (!text) return ''
  return renderInline(text, { glossary })
}

/** `renderPlain`, the same convention, for an `alt`, a `title`, a sort key. */
export function mdStrip(text) {
  if (!text) return ''
  return renderPlain(text)
}
