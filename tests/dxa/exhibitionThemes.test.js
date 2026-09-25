import { computed } from 'vue'
import { describe, expect, it } from 'vitest'
import { buildThemePictures, romanFor, useExhibitionThemes } from '../../src/dxa/exhibition/useExhibitionThemes.js'

// The exhibition's themes layer (inventory-app#2053). The picture graph is a
// pure function, tested over a small fixture; the rest over a hand-built
// `data` object shaped like `useExhibitionData()`'s return.

// Two themes, each with one curated picture, and a related link from theme
// A's picture to theme B's — the shape a cross-theme `theme_item_related` row
// produces. Neither theme's own `pictures[]` resolves the link; only the
// whole-tree map does.
const picA1 = {
  picture_item_id: 'pic-a1',
  display_order: 1,
  related: [
    { picture_item_id: 'pic-b1', descriptions: { en: 'Similar colours' }, reciprocal_descriptions: {} },
  ],
}
const picB1 = { picture_item_id: 'pic-b1', display_order: 1, related: [] }

const pictureById = new Map([
  ['pic-a1', picA1],
  ['pic-b1', picB1],
])

function resolvePicture(raw) {
  return { id: raw.picture_item_id, image: `img-${raw.picture_item_id}`, name: `name-${raw.picture_item_id}` }
}

const deps = {
  pictureById,
  resolvePicture,
  imageCaptionFor: (raw) => `caption-${raw.picture_item_id}`,
  fieldsFor: () => [],
  relationText: (link) => link.descriptions?.en ?? '',
  reciprocalText: (link) => link.reciprocal_descriptions?.en ?? link.descriptions?.en ?? '',
}

describe('buildThemePictures', () => {
  it('resolves a related link whose target is curated under a different theme', () => {
    const [picture] = buildThemePictures([picA1], deps)
    expect(picture.related).toHaveLength(1)
    expect(picture.related[0].picture).toEqual({ id: 'pic-b1', image: 'img-pic-b1', name: 'name-pic-b1' })
    expect(picture.related[0].text).toBe('Similar colours')
  })

  it("finds the reciprocal back-link by scanning the whole tree, not just the node's own siblings", () => {
    const [picture] = buildThemePictures([picB1], deps)
    expect(picture.backRelated).toHaveLength(1)
    expect(picture.backRelated[0].picture).toEqual({ id: 'pic-a1', image: 'img-pic-a1', name: 'name-pic-a1' })
    expect(picture.backRelated[0].reciprocalText).toBe('Similar colours')
  })

  it('carries the node-specific caption, fields and display order alongside the resolved shape', () => {
    const [picture] = buildThemePictures([picA1], deps)
    expect(picture.imageCaption).toBe('caption-pic-a1')
    expect(picture.fields).toEqual([])
    expect(picture.displayOrder).toBe(1)
  })

  it('drops a related link whose target is not in the tree at all', () => {
    const orphan = { picture_item_id: 'pic-a2', display_order: 2, related: [{ picture_item_id: 'does-not-exist' }] }
    const [picture] = buildThemePictures([orphan], deps)
    expect(picture.related).toEqual([])
  })

  it('returns no related or backRelated for a picture with none', () => {
    const lonely = { picture_item_id: 'pic-c1', display_order: 1, related: [] }
    const [picture] = buildThemePictures([lonely], { ...deps, pictureById: new Map([['pic-c1', lonely]]) })
    expect(picture.related).toEqual([])
    expect(picture.backRelated).toEqual([])
  })
})

describe('romanFor', () => {
  it('numbers from the About theme: display order 2 is theme I', () => {
    expect(romanFor(1)).toBe('')
    expect(romanFor(2)).toBe('I')
    expect(romanFor(5)).toBe('IV')
    expect(romanFor(11)).toBe('X')
  })
})

describe('useExhibitionThemes', () => {
  const items = new Map([['item-1', { id: 'item-1', partner_id: 'p-1', country_id: 'c-eg' }]])
  const texts = { 'item-1': { location: 'Cairo' } }
  const themes = useExhibitionThemes({
    defaultLang: 'en',
    itemById: computed(() => items),
    itemRoute: (item) => ({ name: 'item', params: { id: item.id } }),
    labelOf: (entity, id) => ({ partners: { 'p-1': 'Museum One' }, countries: { 'c-eg': 'Egypt' }, items: { 'item-1': 'Bowl' } })[entity]?.[id] ?? '',
    mdInline: (s) => String(s),
    tr: (entity, id) => (entity === 'items' ? texts[id] ?? {} : {}),
  })

  it("resolves a picture to its parent only when the package carries the parent", () => {
    expect(themes.pictureParent({ parent_in_package: true, parent_item_id: 'item-1' })).toEqual(items.get('item-1'))
    expect(themes.pictureParent({ parent_in_package: false, parent_item_id: 'item-1' })).toBeNull()
    expect(themes.pictureParent(null)).toBeNull()
  })

  it("names a parent as legacy's detail line did: museum, location, country", () => {
    expect(themes.itemDetailString(items.get('item-1'))).toBe('Museum One, Cairo, Egypt')
    expect(themes.itemDetailString(null)).toBe('')
  })

  it('maps a route id to its theme through display_order - 1', () => {
    expect(themes.themeRouteId({ display_order: 3 })).toBe(2)
    expect(themes.themeRouteId(null)).toBe(0)
  })

  it('hands EssayView a tree whose nodes read their text from the themes entity', () => {
    expect(themes.themeTree.entity).toBe('themes')
  })
})
