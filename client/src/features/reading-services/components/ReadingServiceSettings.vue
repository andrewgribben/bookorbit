<script setup lang="ts">
/**
 * The settings page a private adapter gets in Settings, next to Readwise/Hardcover: Sign-in,
 * its supported features, library scope, and a note on adding its shelves to the dashboard.
 * Built once, driven entirely by the provider's `GET /reading-services` summary - no adapter-
 * specific code here, so a new private adapter needs zero client changes to show up.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReadingServiceProvider } from '@bookorbit/types'
import SettingsSection from '@/features/settings/components/SettingsSection.vue'
import ReadingServiceAdapterIcon from './ReadingServiceAdapterIcon.vue'
import ReadingServiceSignIn from './ReadingServiceSignIn.vue'
import ReadingServiceFeatureList from './ReadingServiceFeatureList.vue'
import ReadingServiceLibraries from './ReadingServiceLibraries.vue'
import { useReadingServices } from '../composables/useReadingServices'

const props = withDefaults(defineProps<{ provider: string; embedded?: boolean }>(), { embedded: false })

const { t } = useI18n()
const { fetchSummaries, getSummary } = useReadingServices()
const summary = getSummary(props.provider as ReadingServiceProvider)

onMounted(() => {
  void fetchSummaries()
})

const displayName = computed(() => summary.value?.displayName || props.provider)
const authMethods = computed(() => summary.value?.authMethods ?? [])
const hasFeatures = computed(() => summary.value && Object.keys(summary.value.capabilities).length > 0)
</script>

<template>
  <div class="space-y-6" data-testid="reading-service-settings">
    <div v-if="!props.embedded" class="mb-2 flex items-center gap-3">
      <ReadingServiceAdapterIcon :icon-url="summary?.iconUrl" :size="24" />
      <div class="min-w-0">
        <h2 class="settings-title">{{ displayName }}</h2>
        <p v-if="summary?.description" class="settings-subtitle">{{ summary.description }}</p>
      </div>
    </div>

    <ReadingServiceSignIn
      v-if="summary && authMethods.length > 0"
      :provider="provider as ReadingServiceProvider"
      :auth-methods="authMethods"
      :connected="summary.connected"
      :needs-reconnect="summary.needsReconnect ?? false"
      :account-label="summary.accountLabel"
      :display-name="summary.displayName"
      @changed="fetchSummaries"
    />

    <template v-if="summary">
      <SettingsSection
        v-if="hasFeatures"
        :title="t('settings.readingServices.whatSyncs.title')"
        :brief="t('settings.readingServices.whatSyncs.subtitle')"
      >
        <ReadingServiceFeatureList :provider="provider as ReadingServiceProvider" :summary="summary" />
      </SettingsSection>
      <p v-else class="text-sm text-muted-foreground">{{ t('settings.readingServices.generic.noFeatures') }}</p>

      <SettingsSection :title="t('settings.readingServices.libraries.title')" :brief="t('settings.readingServices.libraries.subtitle')">
        <ReadingServiceLibraries :provider="provider as ReadingServiceProvider" :summary="summary" />
      </SettingsSection>

      <p class="text-xs text-muted-foreground">
        {{ t('settings.readingServices.generic.shelvesNote') }}
        <RouterLink to="/" class="text-primary underline underline-offset-2">{{ t('settings.readingServices.generic.shelvesNoteLink') }}</RouterLink>
        .
      </p>
    </template>
  </div>
</template>
