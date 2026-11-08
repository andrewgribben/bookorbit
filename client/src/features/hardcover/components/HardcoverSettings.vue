<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsPageHeader from '@/features/settings/SettingsPageHeader.vue'
import SettingsSection from '@/features/settings/components/SettingsSection.vue'
import HardcoverConnectionCard from '../components/HardcoverConnectionCard.vue'
import HardcoverImportStatus from '../components/HardcoverImportStatus.vue'
import HardcoverLinkedBooks from '../components/HardcoverLinkedBooks.vue'
import HardcoverSyncProgress from '../components/HardcoverSyncProgress.vue'
import ReadingServiceLibraries from '@/features/reading-services/components/ReadingServiceLibraries.vue'
import { useReadingServices } from '@/features/reading-services/composables/useReadingServices'
import { useHardcoverSettings } from '../composables/useHardcoverSettings'
import { useHardcoverSync } from '../composables/useHardcoverSync'

const { t } = useI18n()

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })

const { settings } = useHardcoverSettings()
const { fetchStatus, stopSyncTracking } = useHardcoverSync()
const { fetchSummaries, getSummary } = useReadingServices()
const readingServiceSummary = getSummary('hardcover')

onMounted(async () => {
  await fetchStatus()
  await fetchSummaries()
})

onUnmounted(() => {
  stopSyncTracking()
})
</script>

<template>
  <div class="space-y-6">
    <SettingsPageHeader v-if="!props.embedded" title="Hardcover" :subtitle="t('hardcover.settings.subtitle')" />

    <HardcoverConnectionCard />

    <HardcoverSyncProgress v-if="settings?.tokenConfigured" />

    <HardcoverImportStatus v-if="settings?.tokenConfigured" />
    <HardcoverLinkedBooks v-if="settings?.tokenConfigured" />

    <SettingsSection
      v-if="readingServiceSummary"
      :title="t('settings.readingServices.libraries.title')"
      :brief="t('settings.readingServices.libraries.subtitle')"
    >
      <ReadingServiceLibraries provider="hardcover" :summary="readingServiceSummary" />
    </SettingsSection>
  </div>
</template>
