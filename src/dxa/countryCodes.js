import { computed } from 'vue'

// The DXA legacy country code, the one a gallery's or an exhibition's URLs
// carry (`?country=eg`, the facet values, the timeline's own links), and the
// inventory id the records are keyed by (`egy`). Both families read it for
// their collection and their timeline through this one table
// (inventory-app#2056); each of the four once defined its own.
//
// Names and legacy codes both come from countries.json. The exporter scopes
// that file to "member item countries ∪ their holders' countries ∪ the
// global timeline's countries", so it covers every timeline country — the
// `Intl.DisplayNames` fallback below is therefore dead code for them, and is
// kept only so a regressed package degrades to a rendered ISO code rather
// than a raw id. The `code` countries.json ships is the country's
// `backward_compatibility`, which is exactly the code legacy's own URLs
// used, including the ones that are not ISO 3166-1 alpha-2 (`uk`, `pa`,
// `qt`, `rm`, `sb`, `ua`, …). Those are the reason the fallback must stay
// unreachable rather than merely rare: read as ISO, `ua` is Ukraine and `sb`
// is the Solomon Islands, where legacy means the UAE and Serbia. Only
// countries.json can name them correctly.

// Two legacy codes are not ISO 3166-1 alpha-2.
const LEGACY_TO_ISO = { uk: 'GB', pa: 'PS' }

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

/**
 * The legacy country code both ways, over a family data layer's
 * `countries`, `countryById`, `timelines` and `labelOf`.
 *
 * - `countryIdForCode(code)`: the inventory id for a legacy code; idempotent
 *   on an id (the composed views' own country controls write ids), `null`
 *   for none, `'all'` or an unknown code.
 * - `countryLabel(countryId)`: a country's name, for one countries.json
 *   lacks too (read off its timeline row).
 */
export function useLegacyCountryCodes({ countries, countryById, timelines, labelOf }) {
  const countryIdSet = computed(() => new Set((countries.value ?? []).map((c) => c.id)))

  // A lookup, not a parse. The fallback exists only for the regressed-package
  // case described above, and it must agree with GLOBAL_TIMELINE_LIKE_PATTERNS
  // in the exporter's timeline exporter: the country sits after the literal
  // `country` segment in BOTH keyspaces (`mwnf3:hcr:country:<cc>` and
  // `mwnf3_sharing_history:sh_hcr:country:<cc>:exhibition:2`), and it is the
  // last segment in only the first — taking the last one yields `2` on the
  // second.
  function legacyCodeOf(timeline) {
    const fromPackage = countryById.value.get(timeline.country_id)?.code
    if (fromPackage) return fromPackage
    const parts = (timeline.backward_compatibility ?? '').split(':')
    const at = parts.indexOf('country')
    return (at >= 0 ? parts[at + 1] : null) || timeline.country_id
  }

  function nameFor(timeline) {
    if (countryIdSet.value.has(timeline.country_id)) return labelOf('countries', timeline.country_id)
    const legacy = legacyCodeOf(timeline)
    const iso = LEGACY_TO_ISO[legacy] ?? String(legacy).toUpperCase()
    try {
      return regionNames?.of(iso) ?? iso
    } catch {
      return iso
    }
  }

  function countryLabel(countryId) {
    if (countryIdSet.value.has(countryId)) return labelOf('countries', countryId)
    const timeline = (timelines.value ?? []).find((t) => t.country_id === countryId)
    return timeline ? nameFor(timeline) : countryId
  }

  // A country served by both chronologies has two timeline rows carrying the
  // same code and the same `country_id`, so either row answers.
  function countryIdForCode(code) {
    if (!code || code === 'all') return null
    // Already an id: pass it through unchanged, before the legacy-code
    // lookups below get a chance to find nothing and match every record.
    if (countryIdSet.value.has(code)) return code
    const timeline = (timelines.value ?? []).find((t) => legacyCodeOf(t) === code)
    if (timeline) return timeline.country_id
    // A country with no chronology: countries.json's own code.
    return (countries.value ?? []).find((c) => c.code === code)?.id ?? null
  }

  return { countryIdForCode, countryLabel }
}
