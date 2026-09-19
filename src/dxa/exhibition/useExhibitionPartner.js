// The partner list and profile, as specs. The grouping, the A–Z toggle, the
// tab strip's mechanics, the language switch and the media gallery are the
// platform's (`PartnerListView`/`RecordView`); what stays here is an
// exhibition's own — the E6 hidden-partner rule (the view reads the raw
// `partners` entity directly, not `visiblePartners`, so it never sees that
// filter unless told), the country label, and which route a museum or an
// institution goes to. This exhibition-shaped `partnerSpecs.js` never
// carried an objects-page spec (no `PartnerObjects.vue` counterpart built
// on it), unlike the gallery family's `partner.js`.

/**
 * The exhibition's partner specs, over its data layer's `data`.
 *
 * Reads `data.defaultLang`, `data.isHiddenPartner`, `data.labelOf`,
 * `data.partnerRoute`. `config` carries nothing today.
 */
export function useExhibitionPartner(data, config = {}) {
  void config
  const { defaultLang, isHiddenPartner, labelOf, partnerRoute } = data

  // ── The list (Partners.vue) ─────────────────────────────────────────
  //
  // The DXA shape: no tier column at all — legacy's museum/institution
  // split is a route, not a group here — an A–Z / Z–A toggle over the
  // country groups, and every partner gets a row whether or not it holds
  // anything (legacy's MWNF-384 branch). `variant: 'open'` keeps every
  // group expanded, as legacy's page did with no accordion at all.
  const partnerListSpec = {
    scope: (partner) => !isHiddenPartner(partner),
    group: { tier: false, order: 'country' },
    variant: 'open',
    orderToggle: true,
    label: (countryId) => labelOf('countries', countryId),
    route: (partner) => partnerRoute(partner),
  }

  // ── The profile (PartnerProfile.vue) ─────────────────────────────────
  //
  // No `fields`: legacy's Description/Contact/Logo tabs are three different
  // shapes (Markdown, an address block, a bare image), not three rows of
  // one sheet, so the panel is built in the view's slots over
  // `text`/`record` directly rather than forced through `sheetRows`. No
  // `citation`/`related` either — legacy's partner page has neither.
  const partnerSheetSpec = {
    entity: 'partners',
    route: (partner) => partnerRoute(partner),
    citation: false,
    related: false,
    media: (record, { language }) =>
      [...(record.images ?? [])]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((p) => ({
          url: p.url,
          alt: labelOf('partners', record.id),
          caption: p.captions?.[language] ?? p.captions?.[defaultLang] ?? '',
          photographer: p.photographer ?? '',
          copyright: p.copyright ?? '',
        })),
  }

  return { partnerListSpec, partnerSheetSpec }
}
