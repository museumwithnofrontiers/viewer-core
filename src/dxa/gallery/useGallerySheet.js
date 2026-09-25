// The item sheet, as a spec: what viewer-layout's `RecordView` renders on
// `/item/:id`. The mechanics — which language the record is read in, what
// is loaded for it, the glossary terms it reaches, how a field becomes a
// row, the credits, the citation, the related records — are the platform's.
// What is declared here is only what is a gallery's: the field
// specification (legacy DatabaseItem.vue's `objectData`, field for field),
// the photos in their order, the related tile, and the citation without a
// permalink, as legacy printed it. Every label is an entry name, written
// out so the check that every name resolves can read it.
//
// Order and labels are the legacy sheet's. Empty values are dropped by the
// engine, as legacy's `filterData` did. `notice` and `notice_c` were never
// imported; `notice_b` is the image rights statement, imported as
// `extra.copyright` and rendered as the last row, where legacy put its own
// block. The labels are in the language the visitor reads the website in —
// where it differs from the record's (a deep link into a borrowed record in
// a language a gallery does not offer) they fall back to English, which is
// where legacy pinned them anyway.
//
// Legacy shows both descriptions when both exist, with the short one
// collapsed behind a toggle (the view's, folded after the description);
// when only one exists it is relabelled plain "Description". EPM records
// are the common case of the latter.

/**
 * The gallery's item-sheet spec, over its data layer's `data`.
 *
 * Reads `data.defaultLang`, `data.itemRoute`, `data.labelOf`,
 * `data.mdInline`, `data.mdStrip`, `data.partnerById`, `data.tr`,
 * `data.translations`. `config` carries nothing today.
 */
export function useGallerySheet(data, config = {}) {
  void config
  const { defaultLang, itemRoute, labelOf, mdInline, mdStrip, partnerById, tr, translations } = data

  const bothDescriptions = (c) => Boolean(c.text.description) && Boolean(c.text.short_description)

  const dynastyNames = (c) =>
    (c.record.dynasty_ids ?? [])
      .map((id) => translations('dynasties', c.language)[id]?.name ?? translations('dynasties', defaultLang)[id]?.name ?? '')
      .filter(Boolean)
      .join(', ')

  const fields = [
    { key: 'name', label: 'sheet.field.name', value: 'name' },
    { key: 'aka', label: 'sheet.field.alsoKnownAs', value: 'alternate_name' },
    { key: 'location', label: 'sheet.field.location', value: (c) => [c.text.location, labelOf('countries', c.record.country_id)].filter(Boolean).join(', ') },
    // The holding museum, rendered by the wrapper's `museum` slot: the item's
    // holder text, then the partner it refers to (decision D3,
    // inventory-app#2015). The value is the partner's id when the package
    // carries the partner, otherwise the holder text, so the row stays for an
    // item whose holder has no partner page.
    { key: 'museum', label: 'sheet.field.holdingMuseum', value: (c) => (partnerById.value.get(c.record.partner_id) ? c.record.partner_id : (c.text.holder ?? '')), render: 'custom' },
    { key: 'originalOwner', label: 'sheet.field.originalOwner', value: 'initial_owner' },
    { key: 'currentOwner', label: 'sheet.field.currentOwner', value: 'owner' },
    { key: 'date', label: 'sheet.field.date', value: 'dates' },
    { key: 'artist', label: 'sheet.field.artists', value: (c) => c.record.artist_names, join: ', ' },
    { key: 'scribe', label: 'sheet.field.scribe', value: 'scriber' },
    { key: 'workshop', label: 'sheet.field.workshop', value: 'workshop' },
    { key: 'type', label: 'sheet.field.type', value: 'type' },
    { key: 'inventoryNumber', label: 'sheet.field.inventoryNumber', value: (c) => c.record.owner_reference },
    { key: 'materials', label: 'sheet.field.materials', value: (c) => c.text.materials, join: '; ' },
    { key: 'dimensions', label: 'sheet.field.dimensions', value: 'dimensions' },
    { key: 'dynasty', label: 'sheet.field.periodDynasty', value: dynastyNames },
    { key: 'production', label: 'sheet.field.placeOfProduction', value: 'place_of_production' },
    { key: 'provenance', label: 'sheet.field.provenance', value: 'provenance' },
    { key: 'binding', label: 'sheet.field.binding', value: 'binding_desc' },
    { key: 'description', label: 'sheet.field.description', value: 'description', render: 'block' },
    // The only description there is, under the plain label; the toggled one
    // is the view's, folded after `description` when both exist.
    { key: 'shortDescription', label: 'sheet.field.description', value: 'short_description', render: 'block', when: (c) => !bothDescriptions(c) },
    { key: 'catalogue', label: 'sheet.field.catalogueLink', value: 'linkcatalogs', render: 'link' },
    { key: 'obtention', label: 'sheet.field.obtentionMethod', value: 'obtention' },
    { key: 'datation', label: 'sheet.field.datationMethod', value: 'method_for_datation' },
    { key: 'provenanceMethod', label: 'sheet.field.provenanceMethod', value: 'method_for_provenance' },
    { key: 'bibliography', label: 'sheet.field.bibliography', value: 'bibliography', render: 'block' },
    { key: 'copyright', label: 'sheet.field.copyrightInformation', value: 'copyright' },
  ]

  const itemSheet = {
    entity: 'items',
    translations: ['glossary', 'dynasties', 'partners'],
    // Attribution names are language-independent, but the importer files
    // `author` / `copy_editor` for EPM records on the Arabic row only (a
    // known gap, recorded in the exporter's README). Legacy printed them on
    // every sheet, so the platform reads them off another row when the
    // active one has neither — the one place a page reads across
    // languages, and only for proper names.
    attribution: ['author', 'copy_editor'],
    fields,
    layout: 'list',
    shortDescription: 'short_description',
    shortDescriptionAfter: 'description',
    media: (record, { language }) =>
      [...(record.images ?? [])]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((p) => ({
          url: p.url,
          alt: labelOf('items', record.id),
          caption: p.captions?.[language] ?? p.captions?.[defaultLang] ?? '',
          photographer: p.photographer ?? '',
          copyright: p.copyright ?? '',
        })),
    citation: { permalink: false, heading: 'record.citation.ofThisPage' },
    related: {
      variant: 'grid',
      heading: 'record.related.items',
      actionLabel: 'gallery.action.seeDatabaseEntry',
      record: ({ record: other, justification }) => ({
        id: other.id,
        image: other.images?.[0]?.url ?? '',
        imageAlt: labelOf('items', other.id),
        name: mdInline(tr('items', other.id, defaultLang).name ?? other.internal_name ?? ''),
        meta: [labelOf('countries', other.country_id), justification ? mdStrip(justification) : ''].filter(Boolean),
        to: itemRoute(other),
      }),
    },
    route: 'item',
  }

  return { itemSheet }
}
