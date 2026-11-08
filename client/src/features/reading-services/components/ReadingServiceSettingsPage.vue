<script setup lang="ts">
/** Route-level wrapper reading `:provider` from the URL, so `ReadingServiceSettings` itself stays pure. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ReadingServiceSettings from './ReadingServiceSettings.vue'

const route = useRoute()
const provider = computed(() => (typeof route.params.provider === 'string' ? route.params.provider : ''))
</script>

<template>
  <ReadingServiceSettings v-if="provider" :provider="provider" />
</template>
