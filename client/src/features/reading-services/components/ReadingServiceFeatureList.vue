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
  return t(`settings.readingServices.features.${feature}.label`, { provider: providerLabel.value })
}

function featureHint(feature: ReadingServiceFeature): string {
  return t(`settings.readingServices.features.${feature}.hint`)
}

/**
 * A feature the platform does not have is not rendered at all (owner rule: no "unavailable"
 * rows for missing capabilities). Only a feature the provider actually declares in its
 * `capabilities` map becomes a row.
 */
function isSupported(feature: ReadingServiceFeature): boolean {
  return Boolean(props.summary?.capabilities[feature])
}

/** Rows the provider declares, in the library's fixed display order. */
const supportedFeatures = computed(() => READING_SERVICE_FEATURES.filter((feature) => isSupported(feature)))

function isEnabled(feature: ReadingServiceFeature): boolean {
  // Missing means "not toggled yet"; capabilities are opt-out, so an absent key reads as on.
  return props.summary?.features[feature] !== false
}

/**
 * A supported feature can still be greyed for *state*: `publish_sessions` depends on
 * `sessions` being on. This is the only remaining disabled-with-reason case; everything else
 * that used to show a disabled "not available yet" row is gone because the row itself is gone.
 */
function isDependencyBlocked(feature: ReadingServiceFeature): boolean {
  return feature === 'publish_sessions' && !isEnabled('sessions')
}

function rowHint(feature: ReadingServiceFeature): string {
  if (isDependencyBlocked(feature)) return t('settings.readingServices.features.publish_sessions.dependencyHint')
  return featureHint(feature)
}

async function handleToggle(feature: ReadingServiceFeature, value: boolean): Promise<void> {
  await setFeature(props.provider, feature, value)
}
</script>

<template>
  <div class="border border-border rounded-lg bg-card px-4 py-2 md:px-5 shadow-xs divide-y divide-border">
    <SettingsRow
      v-for="feature in supportedFeatures"
      :key="feature"
      :label="featureLabel(feature)"
      :hint="rowHint(feature)"
      :control-id="`reading-service-${provider}-${feature}`"
      :class="{ 'opacity-60': isDependencyBlocked(feature), 'pl-6': feature === 'publish_sessions' }"
    >
      <span class="text-xs text-muted-foreground whitespace-nowrap">{{ directionLabel(summary?.capabilities[feature]) }}</span>
      <ToggleSwitch
        :id="`reading-service-${provider}-${feature}`"
        :model-value="isEnabled(feature) && !isDependencyBlocked(feature)"
        :disabled="isDependencyBlocked(feature) || savingFeature === feature"
        @update:model-value="(value) => handleToggle(feature, value)"
      />
    </SettingsRow>
  </div>
</template>
