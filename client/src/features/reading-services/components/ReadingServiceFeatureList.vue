<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { READING_SERVICE_FEATURES, type ReadingServiceFeature, type ReadingServiceProvider, type ReadingServiceSummary } from '@bookorbit/types'
import SettingsRow from '@/features/settings/components/SettingsRow.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useReadingServices } from '../composables/useReadingServices'

const props = defineProps<{
  provider: ReadingServiceProvider
  summary: ReadingServiceSummary | null
}>()

const { t } = useI18n()
const { savingFeature, setFeature } = useReadingServices()

const providerLabel = computed(() => props.provider.charAt(0).toUpperCase() + props.provider.slice(1))

function directionLabel(capability: 'both' | 'push' | 'pull' | 'read' | undefined): string {
  switch (capability) {
    case 'both':
      return t('settings.readingServices.whatSyncs.directionBoth')
    case 'push':
      return t('settings.readingServices.whatSyncs.directionPush', { provider: providerLabel.value })
    case 'pull':
      return t('settings.readingServices.whatSyncs.directionPull', { provider: providerLabel.value })
    case 'read':
      return t('settings.readingServices.whatSyncs.directionRead', { provider: providerLabel.value })
    default:
      return t('settings.readingServices.whatSyncs.directionUnavailable')
  }
}

function featureLabel(feature: ReadingServiceFeature): string {
  return t(`settings.readingServices.features.${feature}.label`)
}

function featureHint(feature: ReadingServiceFeature): string {
  return t(`settings.readingServices.features.${feature}.hint`)
}

function unavailableReason(feature: ReadingServiceFeature): string {
  return t(`settings.readingServices.features.${feature}.unavailable`)
}

/**
 * A feature is a toggle row when the provider declares a capability for it. Otherwise it's a
 * disabled row with a one-line reason, since there's no server-side "this provider never
 * supports this" string to render (only `disabledReason` on the connection, which is different).
 */
function isSupported(feature: ReadingServiceFeature): boolean {
  return Boolean(props.summary?.capabilities[feature])
}

function isEnabled(feature: ReadingServiceFeature): boolean {
  // Missing means "not toggled yet"; capabilities are opt-out, so an absent key reads as on.
  return props.summary?.features[feature] !== false
}

async function handleToggle(feature: ReadingServiceFeature, value: boolean): Promise<void> {
  await setFeature(props.provider, feature, value)
}
</script>

<template>
  <div class="border border-border rounded-lg bg-card px-4 py-2 md:px-5 shadow-xs divide-y divide-border">
    <SettingsRow
      v-for="feature in READING_SERVICE_FEATURES"
      :key="feature"
      :label="featureLabel(feature)"
      :hint="isSupported(feature) ? featureHint(feature) : unavailableReason(feature)"
      :control-id="`reading-service-${provider}-${feature}`"
      :class="{ 'opacity-60': !isSupported(feature) }"
    >
      <span class="text-xs text-muted-foreground whitespace-nowrap">{{ directionLabel(summary?.capabilities[feature]) }}</span>
      <ToggleSwitch
        :id="`reading-service-${provider}-${feature}`"
        :model-value="isSupported(feature) && isEnabled(feature)"
        :disabled="!isSupported(feature) || savingFeature === feature"
        @update:model-value="(value) => handleToggle(feature, value)"
      />
    </SettingsRow>
  </div>
</template>
