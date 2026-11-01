import { computed, shallowRef } from 'vue'

// The language the website is shown in, for code that runs outside a
// component: the catalogue data layer is built once, at module scope, where
// `useI18n()` cannot inject. `createViewer` binds the application's locale
// here, the way it hands its configuration to `setSiteConfig`; until it does
// (a test mounting one component), the website is in English.

const BASE_LANGUAGE = 'en'
const bound = shallowRef(null)

/** The active display language, read-only. */
export const displayLanguage = computed(() => bound.value?.value ?? BASE_LANGUAGE)

/** Binds the application's locale ref; `createViewer` calls it once. */
export function bindDisplayLanguage(locale) {
  bound.value = locale ?? null
}
