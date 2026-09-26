import { PAGE_SIZE } from '../shared.js'

// The partner pages, as specs: what viewer-layout's `PartnerListView`,
// `RecordView` and `CatalogueResultsView` render on `/partners`,
// `/partner/:id` and `/partner/:id/objects`. The grouping, the A–Z toggle,
// the record's language and the pagination are the platform's; what is
// declared here is only what is a gallery's: DXA's own list shape (no
// tiers), the country label, and the object grid's tile.

/**
 * The gallery's partner specs, over its data layer's `data` and the
 * `PAGE_SIZE`/`tile` its {@link import('./useGalleryCollection.js').useGalleryCollection}
 * already declared.
 *
 * Reads `data.labelOf`. `config` carries nothing today.
 */
export function useGalleryPartner(data, collection, config = {}) {
  void config
  const { labelOf } = data
  const { tile } = collection

  // ── The list ───────────────────────────────────────────────────────────
  //
  // DXA's own shape, per the package README: no main/associated tiers
  // (every partner is a flat row), grouped by country, with the A–Z / Z–A
  // toggle legacy showed. `route` is a string, so the platform builds each
  // row's link itself; the "View objects" link and the "no objects" line
  // are the site's own `#row` concern in Partners.vue — decision MWNF-384:
  // a partner created under a gallery's own project is listed even when it
  // holds no member item, and only that link is withheld.
  const partnerList = {
    group: { tier: false, order: 'country' },
    variant: 'open',
    orderToggle: true,
    route: 'partner',
    label: (countryId) => labelOf('countries', countryId),
  }

  // ── The profile ────────────────────────────────────────────────────────
  //
  // Legacy's partner page is a tab strip (About/Contact/Logo/homepage),
  // never a table of labelled fields, so `fields` stays empty —
  // PartnerProfile.vue fills `header` and `before-sheet` with the tabs
  // instead — and the sections a sheet carries by default (credits,
  // citation, related records) are switched off: legacy printed none of
  // them on this page.
  const partnerSheet = {
    entity: 'partners',
    fields: [],
    credits: [],
    citation: false,
    related: false,
    route: 'partner',
  }

  // ── The objects page ──────────────────────────────────────────────────
  //
  // The member items one partner holds, on the same grid the collection
  // results and the timeline gallery use. `scope` is built per-page in the
  // site's own PartnerObjects.vue, over the route's own id —
  // `CatalogueResultsView` takes no record id of its own, unlike
  // `RecordView`.
  const partnerObjects = {
    entity: 'items',
    sort: { undated: 'first' },
    pageSize: PAGE_SIZE,
    variant: 'grid',
    recordRoute: 'item',
    actionLabel: 'catalogue.results.seeDatabaseEntry',
    empty: 'gallery.partner.noObjects',
    pagination: { jump: true },
    record: (item, { t }) => tile(item, t),
    summary: ({ pageInfo, t }) => [{ count: pageInfo.total, value: t('partner.item.objectsInSite') }],
  }

  return { partnerList, partnerSheet, partnerObjects }
}
