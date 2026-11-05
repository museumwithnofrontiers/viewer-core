// Legacy's galleries wrote an era "A.D." and "B.C." (dxa-client: the timeline
// and collection year lists, the item sheet, the timeline results), where
// every other website writes "AD" and "BC". A gallery reads its own words
// for them (`withEraWords`, inventory-app#2423).
export const GALLERY_ERA_WORDS = {
  'catalogue.era.ad': 'gallery.era.ad',
  'catalogue.era.bc': 'gallery.era.bc',
}
