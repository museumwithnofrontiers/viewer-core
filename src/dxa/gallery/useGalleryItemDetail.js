import { eraLabel, roundOutward } from '../../catalogue/dates.js'
import { useSiteConfig } from '../../siteConfig.js'
import { useGallerySheet } from './useGallerySheet.js'

// A gallery's item page, as viewer-layout's `RecordSheetView` spec
// (inventory-app#2054): `useGallerySheet`'s field sheet, plus the blocks the
// view reads through `spec.sourceDatabase`, `spec.notice`, `spec.museum` and
// `spec.related.*` — the project chips, the Explore-partner notice, the
// holding-museum link, and the related block's outside references,
// cross-database links, dynasty popouts and timeline popout. The 37
// galleries each carried this layer in their own `composables/gallery.js`,
// the same code in all 37.
//
// What stays a gallery's own is read from its `dataset.config.js` through
// `useSiteConfig()`, lazily, inside the functions the view calls at render
// time — `dataset.config.js` is imported before `createViewer()` sets the
// config, so a read at module level would only ever see the empty default:
//
//   * `projectColors`, project id → one of viewer-layout's `mwnf-chip--*`
//     classes, for the source-database chip and an outside reference's chip;
//   * `noticeProjects`, the projects whose sheets still carry legacy's
//     Explore-partner notice.

/**
 * The gallery's item-page spec, over its data layer's `data` and its
 * timeline layer's `timeline` (`useGalleryTimeline`).
 *
 * Reads `data.defaultLang`, `data.dynastyById`, `data.labelOf`,
 * `data.partnerById`, `data.partnerRoute`, `data.translations`, what
 * `useGallerySheet` reads, and `timeline.countryIdForCode`,
 * `timeline.timelineEvents` (`countries`, `findEvents`).
 */
export function useGalleryItemDetail(data, timeline) {
  const { defaultLang, dynastyById, labelOf, partnerById, partnerRoute, translations } = data
  const { countryIdForCode, timelineEvents } = timeline
  const { countries: timelineCountries, findEvents } = timelineEvents
  const { itemSheet: platformSheet } = useGallerySheet(data)

  const chipClass = (record) => useSiteConfig().projectColors?.[record.project_id] ?? null

  function museumRoute(partnerId) {
    const partner = partnerById.value.get(partnerId)
    return partner ? partnerRoute(partner) : null
  }

  function dynastyTranslation(dynasty, language) {
    return translations('dynasties', language)[dynasty.id] ?? translations('dynasties', defaultLang)[dynasty.id] ?? {}
  }

  // Legacy popped out a dynasty only when it had a history to show.
  function itemDynasties(record, language) {
    const records = (record.dynasty_ids ?? [])
      .map((id) => dynastyById.value.get(id))
      .filter((d) => d && dynastyTranslation(d, language).history)
    return records.length ? { records, tr: (d) => dynastyTranslation(d, language) } : null
  }

  // The timeline popout, for the record's own date range: the gallery's own
  // countries, events and search route.
  function itemTimeline(record, ctx) {
    const [from, to] = roundOutward(record.start_date, record.end_date)
    if (from == null) return null
    return {
      heading: 'gallery.section.timeline',
      countries: timelineCountries.value.map((c) => ({ value: c.value, label: c.label ?? ctx.t('timeline.form.allCountries') })),
      defaultCountry: () => {
        for (const { value: code } of timelineCountries.value) {
          if (countryIdForCode(code) === record.country_id) return code
        }
        return 'all'
      },
      events: (country) => findEvents({ country, begin: from, end: to }),
      range: [from, to],
      era: (year) => eraLabel(year, ctx.t),
      searchTo: (country, [begin, end]) => ({ name: 'timeline-results', query: { country, begin, end } }),
    }
  }

  const itemDetail = {
    ...platformSheet,
    sourceDatabase: {
      chipClass,
    },
    notice: {
      show: (record) => (useSiteConfig().noticeProjects ?? []).includes(record.project_id),
      label: 'gallery.item.explorePartnerNote',
    },
    museum: {
      route: (partnerId) => museumRoute(partnerId),
      label: (partnerId) => labelOf('partners', partnerId),
    },
    related: {
      ...platformSheet.related,
      title: 'gallery.related.title',
      description: 'gallery.related.description',
      notInPackageLabel: 'gallery.results.notInThisGallery',
      // An outside `related_items` reference carries its `project_id`
      // (inventory-app#1807), so it reads the same `projectColors` map.
      outsideChip: chipClass,
      artisticIntroductionLabel: 'gallery.nav.artisticIntroduction',
      databaseLabel: 'gallery.search.relatedDatabase',
      overallDatabase: { label: 'gallery.search.overallDatabase', linkLabel: 'gallery.nav.overallDatabase' },
      onDisplayIn: { linkPendingLabel: 'gallery.item.linkPending' },
      dynasties: (record, language) => itemDynasties(record, language),
      timeline: itemTimeline,
    },
  }

  return { itemDetail }
}
