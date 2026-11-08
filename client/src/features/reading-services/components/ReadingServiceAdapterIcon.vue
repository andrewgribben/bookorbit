<script setup lang="ts">
/**
 * Renders a private adapter's `iconUrl` safely: an http(s)/data URL goes straight into `src`; a
 * raw inline `<svg ...>` string (the other shape the contract allows) is re-encoded as a
 * `data:image/svg+xml` source instead of being dropped in with `v-html`, so nothing the adapter
 * supplies ever reaches the DOM as unsanitised markup. No icon falls back to a plain link glyph.
 */
import { computed } from 'vue'
import { Link2 } from '@lucide/vue'

const props = defineProps<{ iconUrl?: string | null; size?: number | string }>()

const pixelSize = computed(() => {
  const value = Number(props.size)
  return Number.isFinite(value) && value > 0 ? value : 16
})

const src = computed(() => {
  const raw = props.iconUrl?.trim()
  if (!raw) return null
  if (/^<svg[\s>]/i.test(raw)) return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`
  return raw
})
</script>

<template>
  <img v-if="src" :src="src" :width="pixelSize" :height="pixelSize" alt="" />
  <Link2 v-else :size="size" />
</template>
