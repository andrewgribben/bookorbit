import { computed, ref } from 'vue'
import type { ReadingServiceFeature, ReadingServiceLibrarySetting, ReadingServiceProvider, ReadingServiceSummary } from '@bookorbit/types'
import {
  fetchReadingServiceSummaries,
  resetReadingServiceLibrary,
  updateReadingServiceFeatures,
  updateReadingServiceLibrary,
  type ReadingServiceLibraryUpdate,
} from '../api/reading-services.api'

const summaries = ref<ReadingServiceSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const savingFeature = ref<ReadingServiceFeature | null>(null)
const savingLibraryId = ref<number | null>(null)

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

  /**
   * Updates one library's override for a provider (owner decision: scoping is per library AND
   * per feature). Optimistic update of the local `libraries` entry, rolled back on failure.
   */
  async function setLibrary(provider: ReadingServiceProvider, libraryId: number, update: ReadingServiceLibraryUpdate): Promise<boolean> {
    const summary = summaries.value.find((s: ReadingServiceSummary) => s.provider === provider)
    const entry = summary?.libraries.find((l: ReadingServiceLibrarySetting) => l.libraryId === libraryId)
    const previous = entry ? { enabled: entry.enabled, features: { ...entry.features } } : null

    if (entry) {
      if (update.enabled !== undefined) entry.enabled = update.enabled
      if (update.features) Object.assign(entry.features, update.features)
    }

    savingLibraryId.value = libraryId
    error.value = null
    try {
      const updated = await updateReadingServiceLibrary(provider, libraryId, update)
      if (entry) {
        entry.enabled = updated.enabled
        entry.features = updated.features as typeof entry.features
      }
      return true
    } catch (err) {
      if (entry && previous) {
        entry.enabled = previous.enabled
        entry.features = previous.features
      }
      error.value = err instanceof Error ? err.message : 'Failed to update synced library'
      return false
    } finally {
      savingLibraryId.value = null
    }
  }

  /** Resets a library back to "inherit" (enabled, every feature follows the provider toggle). */
  async function resetLibrary(provider: ReadingServiceProvider, libraryId: number): Promise<boolean> {
    const summary = summaries.value.find((s: ReadingServiceSummary) => s.provider === provider)
    const entry = summary?.libraries.find((l: ReadingServiceLibrarySetting) => l.libraryId === libraryId)
    const previous = entry ? { enabled: entry.enabled, features: { ...entry.features } } : null

    savingLibraryId.value = libraryId
    error.value = null
    try {
      const reset = await resetReadingServiceLibrary(provider, libraryId)
      if (entry) {
        entry.enabled = reset.enabled
        entry.features = reset.features as typeof entry.features
      }
      return true
    } catch (err) {
      if (entry && previous) {
        entry.enabled = previous.enabled
        entry.features = previous.features
      }
      error.value = err instanceof Error ? err.message : 'Failed to reset library sync settings'
      return false
    } finally {
      savingLibraryId.value = null
    }
  }

  return { summaries, loading, error, savingFeature, savingLibraryId, fetchSummaries, getSummary, setFeature, setLibrary, resetLibrary }
}
