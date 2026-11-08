import { computed, ref } from 'vue'
import type { ReadingServiceFeature, ReadingServiceProvider, ReadingServiceSummary } from '@bookorbit/types'
import { fetchReadingServiceSummaries, updateReadingServiceFeatures, updateReadingServiceLibraries } from '../api/reading-services.api'

const summaries = ref<ReadingServiceSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const savingFeature = ref<ReadingServiceFeature | null>(null)
const savingLibraries = ref(false)

export function useReadingServices() {
  async function fetchSummaries(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      summaries.value = await fetchReadingServiceSummaries()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load reading services'
    } finally {
      loading.value = false
    }
  }

  function getSummary(provider: ReadingServiceProvider) {
    return computed(() => summaries.value.find((summary) => summary.provider === provider) ?? null)
  }

  async function setFeature(provider: ReadingServiceProvider, feature: ReadingServiceFeature, enabled: boolean): Promise<boolean> {
    const summary = summaries.value.find((s) => s.provider === provider)
    const previous = summary?.features[feature]
    if (summary) summary.features[feature] = enabled

    savingFeature.value = feature
    error.value = null
    try {
      const updated = await updateReadingServiceFeatures(provider, { [feature]: enabled })
      if (summary) Object.assign(summary.features, updated)
      return true
    } catch (err) {
      if (summary) summary.features[feature] = previous
      error.value = err instanceof Error ? err.message : 'Failed to update sync settings'
      return false
    } finally {
      savingFeature.value = null
    }
  }

  async function setLibraryIds(provider: ReadingServiceProvider, libraryIds: number[] | null): Promise<boolean> {
    const summary = summaries.value.find((s) => s.provider === provider)
    const previous = summary?.libraryIds

    savingLibraries.value = true
    error.value = null
    try {
      const updated = await updateReadingServiceLibraries(provider, libraryIds)
      if (summary) summary.libraryIds = updated.libraryIds
      return true
    } catch (err) {
      if (summary) summary.libraryIds = previous
      error.value = err instanceof Error ? err.message : 'Failed to update synced libraries'
      return false
    } finally {
      savingLibraries.value = false
    }
  }

  return { summaries, loading, error, savingFeature, savingLibraries, fetchSummaries, getSummary, setFeature, setLibraryIds }
}
