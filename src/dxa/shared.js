import { useI18n } from '../i18n/index.js'

// The five THG catalogue facets, shared verbatim by both DXA families (a
// gallery's and an exhibition's `useCollection.js` declared the exact same
// four constants and helper) — everything else about a family's catalogue
// spec (the facet *predicates*, the tile, the results spec) reads real
// per-family data and stays in `gallery/useGalleryCollection.js` /
// `exhibition/useExhibitionCollection.js`.

/** Nine tiles a page, as legacy's grids showed. */
export const PAGE_SIZE = 9

/**
 * Decision D5: the DXA sites test containment — `na <= start_date` and
 * `nz >= coalesce(end_date, start_date)` in `Objects.blade.php` — so an
 * undated record is out the moment a bound is set.
 */
export const DATE_MODE = 'contain'

// The five THG facet categories, in the order the legacy form shows them.
// `artist` has no dropdown in dxa-client, but the category exists in the
// data and the exporter ships it, so it renders whenever it has a value — a
// superset of legacy, never a different answer.
export const FACET_CATEGORIES = ['type', 'dynasty', 'subject', 'material', 'artist']

/**
 * The heading each facet dropdown carries, as entry names. Written out once
 * here so both the entrance's `SearchFormView` spec (which translates a
 * facet's `label` itself) and the results page's own aside panel (which
 * wants the translated string) read the same five names, and so
 * `viewer-i18n-check` can see them.
 */
export const FACET_LABEL_KEYS = {
  type: 'catalogue.facet.type',
  dynasty: 'catalogue.facet.periodDynasty',
  subject: 'catalogue.facet.subject',
  material: 'catalogue.facet.material',
  artist: 'catalogue.facet.artist',
}

// Every name written out, not read off `FACET_LABEL_KEYS` through a
// variable: `viewer-i18n-check` only sees a name spelled out at the call
// site, so a loop over the map above would be invisible to it.
export function useFacetLabels() {
  const { t } = useI18n()
  return {
    type: t('catalogue.facet.type'),
    dynasty: t('catalogue.facet.periodDynasty'),
    subject: t('catalogue.facet.subject'),
    material: t('catalogue.facet.material'),
    artist: t('catalogue.facet.artist'),
  }
}
