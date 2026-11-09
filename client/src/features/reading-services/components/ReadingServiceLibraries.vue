<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { READING_SERVICE_FEATURES, type ReadingServiceFeature, type ReadingServiceProvider, type ReadingServiceSummary } from '@bookorbit/types'
import AppIcon from '@/components/AppIcon.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useLibraries } from '@/features/library/composables/useLibraries'
import { useReadingServices } from '../composables/useReadingServices'

const props = defineProps<{
  provider: ReadingServiceProvider
  summary: ReadingServiceSummary | null
}>()

const { t } = useI18n()
const { libraries, fetchLibraries } = useLibraries()
const { savingLibraryId, setLibrary, resetLibrary } = useReadingServices()

onMounted(() => {
  void fetchLibraries()
})

const expandedLibraryId = ref<number | null>(null)

/** Only features the provider actually supports (has a capability for) are worth customising per library. */
const customisableFeatures = computed<ReadingServiceFeature[]>(
  () => READING_SERVICE_FEATURES.filter((feature) => Boolean(props.summary?.capabilities[feature])) as ReadingServiceFeature[],
)

function entryFor(libraryId: number) {
  return props.summary?.libraries.find((l) => l.libraryId === libraryId) ?? null
}

/** A library has a customised feature when at least one of the provider's on features is overridden off for it. */
function hasCustomisation(libraryId: number): boolean {
  const entry = entryFor(libraryId)
  if (!entry) return false
  return customisableFeatures.value.some((feature) => entry.features[feature] === false) || entry.seriesMode
}

function isLibraryEnabled(libraryId: number): boolean {
  return entryFor(libraryId)?.enabled ?? true
}

function isFeatureEnabled(libraryId: number, feature: ReadingServiceFeature): boolean {
  const entry = entryFor(libraryId)
  return entry?.features[feature] !== false
}

function toggleExpanded(libraryId: number): void {
  expandedLibraryId.value = expandedLibraryId.value === libraryId ? null : libraryId
}

async function handleEnabledToggle(libraryId: number, value: boolean): Promise<void> {
  await setLibrary(props.provider, libraryId, { enabled: value })
}

async function handleFeatureToggle(libraryId: number, feature: ReadingServiceFeature, value: boolean): Promise<void> {
  await setLibrary(props.provider, libraryId, { features: { [feature]: value } })
}

async function handleReset(libraryId: number): Promise<void> {
  await resetLibrary(props.provider, libraryId)
}

function featureLabel(feature: ReadingServiceFeature): string {
  return t(`settings.readingServices.features.${feature}.label`)
}

const showsSeriesMode = computed(() => props.provider === 'readwise')

function isSeriesModeEnabled(libraryId: number): boolean {
  return entryFor(libraryId)?.seriesMode ?? false
}

async function handleSeriesModeToggle(libraryId: number, value: boolean): Promise<void> {
  await setLibrary(props.provider, libraryId, { seriesMode: value })
}
</script>

<template>
  <div class="border border-border rounded-lg bg-card px-4 py-2 md:px-5 shadow-xs divide-y divide-border">
    <p v-if="libraries.length === 0" class="py-3 text-xs text-muted-foreground">{{ t('settings.readingServices.libraries.empty') }}</p>
    <div v-for="library in libraries" :key="library.id" class="py-2">
      <div class="flex items-center gap-3">
        <AppIcon :name="library.icon ?? 'BookOpen'" class="size-4 text-muted-foreground shrink-0" />
        <span class="flex-1 text-sm font-medium truncate">{{ library.name }}</span>

        <button
          v-if="(customisableFeatures.length > 0 || showsSeriesMode) && isLibraryEnabled(library.id)"
          type="button"
          class="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          @click="toggleExpanded(library.id)"
        >
          {{ t('settings.readingServices.libraries.customise') }}
        </button>

        <button
          v-if="entryFor(library.id)"
          type="button"
          class="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          @click="handleReset(library.id)"
        >
          {{ t('settings.readingServices.libraries.reset') }}
        </button>

        <ToggleSwitch
          :id="`reading-service-${provider}-library-${library.id}`"
          :model-value="isLibraryEnabled(library.id)"
          :disabled="savingLibraryId === library.id"
          @update:model-value="(value) => handleEnabledToggle(library.id, value)"
        />
      </div>

      <p v-if="!entryFor(library.id)" class="pl-7 text-xs text-muted-foreground">{{ t('settings.readingServices.libraries.inherits') }}</p>
      <p v-else-if="hasCustomisation(library.id)" class="pl-7 text-xs text-muted-foreground">
        {{ t('settings.readingServices.libraries.customised') }}
      </p>

      <div v-if="expandedLibraryId === library.id && isLibraryEnabled(library.id)" class="pl-7 mt-2 space-y-2">
        <div v-for="feature in customisableFeatures" :key="feature" class="flex items-center justify-between gap-3">
          <span class="text-xs text-muted-foreground">{{ featureLabel(feature) }}</span>
          <ToggleSwitch
            :id="`reading-service-${provider}-library-${library.id}-${feature}`"
            :model-value="isFeatureEnabled(library.id, feature)"
            :disabled="savingLibraryId === library.id"
            @update:model-value="(value) => handleFeatureToggle(library.id, feature, value)"
          />
        </div>

        <div v-if="showsSeriesMode" class="flex items-start justify-between gap-3 pt-1">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('settings.readingServices.libraries.seriesMode.label') }}</p>
            <p class="text-xs text-muted-foreground/70">{{ t('settings.readingServices.libraries.seriesMode.helper') }}</p>
          </div>
          <ToggleSwitch
            :id="`reading-service-${provider}-library-${library.id}-series-mode`"
            :model-value="isSeriesModeEnabled(library.id)"
            :disabled="savingLibraryId === library.id"
            @update:model-value="(value) => handleSeriesModeToggle(library.id, value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
