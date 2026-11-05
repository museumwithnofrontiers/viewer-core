<script setup>
import { computed } from 'vue'
import { useI18n } from './index.js'
import { renderBlock } from './markdown.js'

// `blankLines`: each blank line between two blocks a `<br>` (renderBlock),
// for a page that sets legacy's line spacing.
const props = defineProps({
  keypath: { type: String, required: true },
  tag: { type: String, default: 'div' },
  blankLines: { type: Boolean, default: false },
})

const { t } = useI18n()
const html = computed(() => renderBlock(t(props.keypath), { blankLines: props.blankLines }))
</script>

<template>
  <component :is="tag" class="vc-text" v-html="html" />
</template>
