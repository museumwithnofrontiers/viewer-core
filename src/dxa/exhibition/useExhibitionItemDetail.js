import { eraLabel, roundOutward } from '../../catalogue/dates.js'
import { useSiteConfig } from '../../siteConfig.js'
import { useExhibitionSheet } from './useExhibitionSheet.js'

// An exhibition's item page, as viewer-layout's `RecordSheetView` spec
// (inventory-app#2053): `useExhibitionSheet`'s field sheet, plus the blocks
// the view reads through `spec.sourceDatabase`, `spec.notice`, `spec.museum`
// and `spec.related.*`. The six exhibitions each carried this layer as their
// own `composables/sheet.js`, the same code in all six.
//
// What stays an exhibition's own is read from its `dataset.config.js`
// through `useSiteConfig()`, lazily, as the galleries do:
//
//   * `projectColors`, project id → one of viewer-layout's `mwnf-chip--*`
//     classes, for the source-database chip and an outside reference's chip;
//     a record with no project at all is an Explore record, whose chip is
//     `mwnf-chip--Explore`;
//   * `noticeProjects`, the projects whose sheets still carry legacy's
//     Explore-partner notice.

/**
 * The exhibition's item-page spec, over its data layer's `data` and its
 * timeline layer's `timeline` (`useExhibitionTimeline`).
 *
 * Reads `data.defaultLang`, `data.dynastyById`, `data.isExploreRecord`,
 * `data.isHiddenPartner`, `data.labelOf`, `data.partnerById`,
 * `data.partnerRoute`, `data.translations`, what `useExhibitionSheet` reads,
 * and `timeline.countryIdForCode`, `timeline.hasTimeline`,
 * `timeline.timelineEvents` (`countries`, `findEvents`), `timeline.timelineSpec`.
 */
export function useExhibitionItemDetail(data, timeline) {
  const {
    defaultLang, dynastyById, isExploreRecord, isHiddenPartner, labelOf, partnerById, partnerRoute, translations,
  } = data
  const { countryIdForCode, hasTimeline, timelineEvents, timelineSpec } = timeline
  const { countries: timelineCountries, findEvents } = timelineEvents
  const { itemSheet: platformSheet } = useExhibitionSheet(data)

  function chipClass(record) {
    return useSiteConfig().projectColors?.[record.project_id] ?? (isExploreRecord(record) ? 'mwnf-chip--Explore' : null)
  }

  function dynastyTr(dynasty, language) {
    return translations('dynasties', language)[dynasty.id] ?? translations('dynasties', defaultLang)[dynasty.id] ?? {}
  }

  // Legacy popped out a dynasty only when it had a history to show.
  function dynastiesWithHistory(record, language) {
    return (record.dynasty_ids ?? [])
      .map((id) => dynastyById.value.get(id))
      .filter((d) => d && dynastyTr(d, language).history)
  }

  // The country the "Timeline for this item" popout opens on: the picker's
  // entry for the record's own country.
  function countryOf(countryId) {
    for (const { value } of timelineCountries.value) {
      if (countryIdForCode(value) === countryId) return value
    }
    return null
  }

  // The popout's "search this period" link: the timeline results filtered to
  // the country and the period, under the keys the results page's controls
  // read — never a key it has no control for (a local timeline has no
  // country), which it would ignore (inventory-app#2022).
  function periodSearch(country, range) {
    const keys = new Set((timelineSpec.value?.controls ?? []).map((control) => control.key))
    const query = { country, begin: range[0], end: range[1] }
    return { name: 'timeline-results', query: Object.fromEntries(Object.entries(query).filter(([key]) => keys.has(key))) }
  }

  const itemDetail = {
    ...platformSheet,

    sourceDatabase: {
      chipClass: (record) => chipClass(record),
    },

    notice: {
      show: (record) => (useSiteConfig().noticeProjects ?? []).includes(record.project_id),
      label: 'partner.item.explorePartnerNote',
    },

    // A hidden museum keeps its name on the sheet and loses the link: it has
    // no page to link to.
    museum: {
      route: (partnerId) => {
        const partner = partnerById.value.get(partnerId)
        if (!partner || isHiddenPartner(partner)) return null
        return partnerRoute(partner)
      },
      label: (partnerId) => labelOf('partners', partnerId),
    },

    related: {
      ...platformSheet.related,
      title: 'record.related.title',
      description: 'record.related.description',
      outsideChip: (ref) => chipClass(ref),
      notInPackageLabel: 'exhibition.results.notInThisExhibition',
      artisticIntroductionLabel: 'core.nav.artisticIntroduction',
      databaseLabel: 'catalogue.search.relatedDatabase',
      overallDatabase: { label: 'catalogue.search.overallDatabase', linkLabel: 'core.nav.overallDatabase' },
      onDisplayIn: { linkPendingLabel: 'record.related.linkPending' },
      dynasties: (record, language) => ({
        records: dynastiesWithHistory(record, language),
        tr: (d) => dynastyTr(d, language),
      }),
      // Withheld when the exhibition reports no chronology, or the item has
      // no date to anchor a range on: legacy then printed no "timeline"
      // anywhere on the sheet.
      timeline: (record, ctx) => {
        if (!hasTimeline.value) return null
        const range = roundOutward(record.start_date, record.end_date)
        if (range[0] == null) return null
        return {
          heading: 'core.section.timeline',
          countries: timelineCountries.value.map((c) => ({ value: c.value, label: c.label ?? ctx.t('timeline.form.allCountries') })),
          defaultCountry: () => countryOf(record.country_id) ?? 'all',
          events: (country) => findEvents({ country, begin: range[0], end: range[1] }),
          range,
          era: (year) => eraLabel(year, ctx.t),
          searchTo: periodSearch,
        }
      },
    },
  }

  return { itemDetail }
}
