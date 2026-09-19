// The DXA gallery/exhibition composables (epic #1730): the data layer,
// catalogue spec, timeline spec, partner specs and item-sheet spec each of
// the two live DXA site pairs (carpets/amulets — a gallery; the-use-of-
// colours-in-art/water-in-islam — an exhibition) wrote for itself,
// byte-identical within each pair. Promoted here per family, never as one
// composable that papers over the two — the cross-family diff is real
// behaviour (see each file's own header), not just naming.
//
// A site composes its own module from these, passing the `data` object one
// family's `useGalleryData()`/`useExhibitionData()` call returns into the
// rest:
//
//   import { useGalleryData, useGalleryCollection, useGalleryTimeline, useGalleryPartner, useGallerySheet } from '@museumwnf/viewer-core/dxa'
//
//   const data = useGalleryData()
//   const collection = useGalleryCollection(data)
//   const timeline = useGalleryTimeline(data, collection)
//   const partner = useGalleryPartner(data, collection)
//   const sheet = useGallerySheet(data)

// Shared verbatim by both families — see shared.js.
export { DATE_MODE, FACET_CATEGORIES, FACET_LABEL_KEYS, PAGE_SIZE, useFacetLabels } from './shared.js'

export { useGalleryData } from './gallery/useGalleryData.js'
export { useGalleryCollection } from './gallery/useGalleryCollection.js'
export { useGalleryTimeline } from './gallery/useGalleryTimeline.js'
export { useGalleryPartner } from './gallery/useGalleryPartner.js'
export { useGallerySheet } from './gallery/useGallerySheet.js'

export { useExhibitionData } from './exhibition/useExhibitionData.js'
export { useExhibitionCollection } from './exhibition/useExhibitionCollection.js'
export { useExhibitionTimeline } from './exhibition/useExhibitionTimeline.js'
export { useExhibitionPartner } from './exhibition/useExhibitionPartner.js'
export { useExhibitionSheet } from './exhibition/useExhibitionSheet.js'
