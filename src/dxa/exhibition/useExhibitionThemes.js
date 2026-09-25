import { computed } from 'vue'
import { useI18n } from '../../i18n/index.js'
import { entityRef } from '../../composables/useEntities.js'
import { useCollectionTree } from '../../record/collectionTree.js'

// An exhibition's themes: the tour its theme pages, its themes list and its
// theme galleries read (inventory-app#2053). The six exhibitions each carried
// this as `composables/themes.js`, `useThemePresentation.js` and
// `useThemePictures.js`, the same code in all six.
//
// themes.json is the ordered tree: top-level themes, each with its sub-themes
// and its curated picture selections. `useCollectionTree({ source: 'themes' })`
// walks it, and its `previous`/`next` (depth-first) is legacy's tour order:
// About → theme 1 overview → its sub-themes → theme 2 overview → ….
//
// Two rules the data fixes rather than taste:
//
//   * Theme 0 ("About the Exhibition") is an ordinary top-level theme legacy
//     renders at /about and skips on /themes. Its display order is 1, so the
//     themes list starts at display order 2 and numbers those "Theme I"
//     upwards — which is why `romanFor` subtracts one.
//   * The theme id in the keyspace is not the display order. The route
//     carries `display_order - 1`, as legacy's `theme.display - 1` did, so a
//     legacy address pasted after the `#` lands on the same theme.
//
// A theme's selections point at `picture` items, which are not members of the
// exhibition and so not in items.json — only their parents are. Every label a
// theme page shows (name, holding museum, location, country) is read off the
// parent record, which is also what "see the full record" links to.
// `parent_in_package` says whether the parent is there at all: a curated
// picture whose parent was not exported still renders its own image.

/**
 * Legacy numbered its themes in Roman numerals, counting from the About
 * theme. EssayView's `numbering: 'roman'` counts a node's position among its
 * siblings, which it derives from `tree.root` — always null for a themes.json
 * package — so it would number every top-level theme "I". The numeral an
 * exhibition shows is always the owning theme's, so one function serves
 * themes and sub-themes.
 */
export function romanFor(displayOrder) {
  const lookup = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
    ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ]
  let n = displayOrder - 1
  let out = ''
  for (const [sym, value] of lookup) {
    while (n >= value) { out += sym; n -= value }
  }
  return out
}

/**
 * The `pictures` PictureGallery/PictureNarrative read (viewer-layout's
 * docs/theme-components.md) for one node, as a pure function of its data so
 * the graph rules are tested without Vue or a package.
 *
 * A picture's `related`/`backRelated` targets resolve against `pictureById`,
 * the WHOLE tree's picture index, not the node's own selections:
 * `theme_item_related` rows can name a picture curated under another theme,
 * and scoping the lookup to the node is what used to drop such a link.
 *
 * @param nodePictures - the node's own selections, in curator order
 * @param deps.pictureById - Map<pictureId, rawPicture> for every picture in the tree
 * @param deps.resolvePicture - (raw) => `{ id, image, imageAlt, name, detail, to }`,
 *   the node-independent shape, used for the node's pictures and every target
 * @param deps.imageCaptionFor - (raw) => this node's own caption for the picture
 * @param deps.fieldsFor - (raw) => this node's panel `fields` for the picture
 * @param deps.relationText - (link) => the forward relation's text
 * @param deps.reciprocalText - (link) => the backward relation's text
 */
export function buildThemePictures(nodePictures, deps) {
  const {
    pictureById: byId, resolvePicture, imageCaptionFor, fieldsFor, relationText, reciprocalText,
  } = deps

  return (nodePictures ?? []).map((raw) => {
    const related = (raw.related ?? [])
      .map((link) => {
        const target = byId.get(link.picture_item_id)
        return target ? { picture: resolvePicture(target), text: relationText(link) } : null
      })
      .filter(Boolean)

    // Every other picture anywhere in the tree whose own `related` names this
    // one, so a target on another theme's page still shows "related to" back.
    const backRelated = []
    for (const other of byId.values()) {
      for (const link of other.related ?? []) {
        if (link.picture_item_id === raw.picture_item_id) {
          backRelated.push({ picture: resolvePicture(other), reciprocalText: reciprocalText(link) })
        }
      }
    }

    return {
      ...resolvePicture(raw),
      imageCaption: imageCaptionFor(raw),
      fields: fieldsFor(raw),
      // Not part of the components' contract: the theme page turns a
      // selection back into legacy's `?image=<display_order>` with it.
      displayOrder: raw.display_order,
      related,
      backRelated,
    }
  })
}

/**
 * The exhibition's themes, over its data layer's `data`.
 *
 * Reads `data.defaultLang`, `data.itemById`, `data.itemRoute`, `data.labelOf`,
 * `data.mdInline`, `data.tr`.
 */
export function useExhibitionThemes(data) {
  const { defaultLang, itemById, itemRoute, labelOf, mdInline, tr } = data

  // EssayView reads `spec.tree.entity` to know where a node's own text lives,
  // even for a tree built here rather than from its `{ themes: true }`
  // shorthand; without it, every title/quote/body lookup would read
  // 'collections', not a themes.json package's entity.
  const themeTree = useCollectionTree({ source: 'themes', entity: 'themes' })
  themeTree.entity = 'themes'

  // The raw top-level array, in the order the themes list and the tour read
  // them: the tree's own `root` is always null for this shape, so it cannot
  // hand back every top-level theme itself.
  const rawThemes = entityRef('themes')
  const themes = computed(() => rawThemes.value ?? [])

  const aboutTheme = computed(() => themes.value.find((t) => t.display_order === 1) ?? null)

  /** The themes the themes page lists: everything after the About theme. */
  const listedThemes = computed(() => themes.value.filter((t) => t.display_order > 1))

  /** Route id → theme: legacy's `/theme/:id` carries `display_order - 1`. */
  function themeByRouteId(id) {
    const n = Number(id)
    return themes.value.find((t) => t.display_order - 1 === n) ?? null
  }

  function themeRouteId(theme) {
    return (theme?.display_order ?? 1) - 1
  }

  /** A node's picture selections, in curator order. */
  function themePictures(theme) {
    return [...(theme?.pictures ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }

  /** Every picture selection in the tree, by its own id (not a catalogue id). */
  const pictureById = computed(() => {
    const map = new Map()
    for (const node of themeTree.byId.value.values()) {
      for (const picture of node.pictures ?? []) map.set(picture.picture_item_id, picture)
    }
    return map
  })

  // translations/themes.<lang>.json is keyed two ways: by theme id for the
  // theme's own title/quote/presentation, and by `<theme id>/<picture item
  // id>` for one picture's curated text in that theme — the same picture in
  // two themes carries two descriptions.
  function themeText(theme, lang = defaultLang) {
    return tr('themes', theme?.id, lang)
  }

  function pictureText(theme, picture, lang = defaultLang) {
    if (!theme?.id || !picture?.picture_item_id) return {}
    return tr('themes', `${theme.id}/${picture.picture_item_id}`, lang)
  }

  /** The top-level theme that owns a node: the node itself, or its parent. */
  function owningTheme(node) {
    if (!node) return null
    const parents = themeTree.parents(node.id)
    return parents.length ? parents[0] : node
  }

  /** A node's 1-based position among its owning theme's sub-themes; null for the theme itself. */
  function subIndexOf(node) {
    if (!node) return null
    const owner = owningTheme(node)
    if (!owner || owner.id === node.id) return null
    const index = themeTree.children(owner.id).findIndex((child) => child.id === node.id)
    return index === -1 ? null : index + 1
  }

  /** A picture selection's parent record, or null when it is not a member. */
  function pictureParent(picture) {
    if (!picture?.parent_in_package) return null
    return itemById.value.get(picture.parent_item_id) ?? null
  }

  /** Legacy's `itemDetailString`: museum, location, country, blanks dropped. */
  function itemDetailString(item) {
    if (!item) return ''
    const sheet = tr('items', item.id, defaultLang)
    return [
      sheet.holder || labelOf('partners', item.partner_id),
      sheet.location,
      labelOf('countries', item.country_id),
    ].filter(Boolean).join(', ')
  }

  /**
   * A node's `pictures`, live: its selections resolved against the parent
   * records, the translations and the current locale. Call it in a
   * component's setup; `node` is a ref.
   */
  function useThemePictures(node) {
    const { t, locale } = useI18n()

    function resolvePicture(raw) {
      const parent = pictureParent(raw)
      const name = parent ? labelOf('items', parent.id) : ''
      return {
        id: raw.picture_item_id,
        image: raw.image_url,
        imageAlt: name,
        name: mdInline(name),
        detail: itemDetailString(parent),
        to: parent ? itemRoute(parent) : null,
      }
    }

    function imageCaptionFor(raw) {
      if (!node.value?.id) return ''
      return tr('themes', `${node.value.id}/${raw.picture_item_id}`, locale.value).image_caption ?? ''
    }

    // Legacy labelled only "also known as"; artist names and dates stand
    // alone, as `fields` rows with an empty label.
    function fieldsFor(raw) {
      const parent = pictureParent(raw)
      if (!parent) return []
      const sheet = tr('items', parent.id, defaultLang)
      const fields = []
      if (sheet.alternate_name) {
        fields.push({ label: `${t('sheet.field.alsoKnownAs')}:`, value: mdInline(sheet.alternate_name) })
      }
      if (parent.artist_names?.length) fields.push({ label: '', value: parent.artist_names.join(', ') })
      if (sheet.dates) fields.push({ label: '', value: sheet.dates })
      return fields
    }

    const relationText = (link) => link?.descriptions?.[locale.value] ?? link?.descriptions?.en ?? ''
    const reciprocalText = (link) => link?.reciprocal_descriptions?.[locale.value] ?? link?.reciprocal_descriptions?.en ?? ''

    return computed(() => buildThemePictures(themePictures(node.value), {
      pictureById: pictureById.value,
      resolvePicture,
      imageCaptionFor,
      fieldsFor,
      relationText,
      reciprocalText,
    }))
  }

  return {
    themeTree,
    themes,
    aboutTheme,
    listedThemes,
    themeByRouteId,
    themeRouteId,
    romanFor,
    themePictures,
    pictureById,
    themeText,
    pictureText,
    owningTheme,
    subIndexOf,
    pictureParent,
    itemDetailString,
    useThemePictures,
  }
}
