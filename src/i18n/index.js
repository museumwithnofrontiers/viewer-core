import { computed, inject, ref } from 'vue'

// The renderers travel with the texts: a package that has only this entry
// point (@museumwnf/viewer-layout) renders a Markdown prop through the same
// pipeline as everything else.
export { md, mdInline, mdStrip, renderBlock, renderInline, renderPlain } from './markdown.js'

// The whole of it: look a key up in the active language, fall back to English,
// and return the key itself when neither has it, so a missing text shows up as
// its own name rather than as a blank page.
//
// The scope of this module is frozen. It does lookup, fallback and reactivity;
// it will never grow interpolation, pluralisation or a message format. A text
// is a text — a value produced at run time is rendered by the component next
// to the text, never inside it. A future need outside that is a different
// system, not an extension of this one.

// Symbol.for, not Symbol: this module is reachable through two specifiers —
// `@museumwnf/viewer-core` (which createViewer imports relatively) and
// `@museumwnf/viewer-core/i18n` (which viewer-layout imports) — and a bundler
// that resolves them to two module instances would create two distinct keys.
// The application would then provide one and the layout inject the other,
// which reads as "no texts installed" in a package that plainly installed
// them. A key from the global registry is the same key in every instance.
export const VIEWER_I18N = Symbol.for('@museumwnf/viewer-core:i18n')

const BASE_LANGUAGE = 'en'

/**
 * Apply the one merge rule of the platform: local wins.
 *
 * Each argument is `{ <language>: { <key>: <text> } }` — the shared bundle
 * first, the website's own file last. Keys carry their namespace, so nothing
 * collides by accident; an entry is overloaded only when a website spells out
 * the same name.
 */
export function mergeMessages(...catalogues) {
  const merged = {}
  for (const catalogue of catalogues) {
    for (const [language, entries] of Object.entries(catalogue ?? {})) {
      merged[language] = { ...merged[language], ...entries }
    }
  }
  return merged
}

export function createI18n({ messages = {}, locale = BASE_LANGUAGE } = {}) {
  const current = ref(locale)

  // A text in a language of the caller's choosing (a record's own, say),
  // English where that language has none.
  const tIn = (language, key) => {
    const active = messages[language]
    if (active && typeof active[key] === 'string') return active[key]
    const base = messages[BASE_LANGUAGE]
    if (base && typeof base[key] === 'string') return base[key]
    return key
  }

  const t = (key) => tIn(current.value, key)

  const i18n = {
    locale: current,
    availableLocales: Object.keys(messages),
    t,
    tIn,
    install(app) {
      app.provide(VIEWER_I18N, i18n)
      // `$t` in a template, `useI18n()` in a script — the two shapes Vue
      // applications already expect of a translation helper.
      app.config.globalProperties.$t = t
    },
  }
  return i18n
}

export function useI18n() {
  const i18n = inject(VIEWER_I18N, null)
  if (!i18n) {
    throw new Error(
      'useI18n() was called in an application that has no texts installed. ' +
        'Applications built with createViewer() have them; a test mounting a ' +
        'component on its own must install createI18n({ messages }) itself.'
    )
  }
  return i18n
}

/** The active language, for a component that only needs to read it. */
export function useLocale() {
  const { locale } = useI18n()
  return computed(() => locale.value)
}
