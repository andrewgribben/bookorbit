import { ref } from 'vue'
import type { TkBackfillPreview, TkSettings, UpsertTkSettingsPayload } from '@bookorbit/types'
import { disconnectTk, fetchTkSettings, finishTkConnect, previewTkBackfill, requestTkBackfill, startTkConnect, upsertTkSettings } from '../api/tk.api'

type TkSyncKind = 'syncAnnotations' | 'syncJournal' | 'syncFinished'

const settings = ref<TkSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const connecting = ref(false)
const error = ref<string | null>(null)
const savingSyncKind = ref<TkSyncKind | null>(null)

export function useTkSettings() {
  async function fetchSettings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      settings.value = await fetchTkSettings()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load settings'
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(payload: UpsertTkSettingsPayload): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      settings.value = await upsertTkSettings(payload)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save settings'
      return false
    } finally {
      saving.value = false
    }
  }

  async function connectStart(): Promise<string | null> {
    connecting.value = true
    error.value = null
    try {
      const { authorizeUrl } = await startTkConnect()
      return authorizeUrl
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start connecting TK'
      return null
    } finally {
      connecting.value = false
    }
  }

  async function connectFinish(callbackUrl: string): Promise<boolean> {
    connecting.value = true
    error.value = null
    try {
      settings.value = await finishTkConnect({ callbackUrl })
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to finish connecting TK'
      return false
    } finally {
      connecting.value = false
    }
  }

  async function disconnect(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      settings.value = await disconnectTk()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to disconnect TK'
      return false
    } finally {
      saving.value = false
    }
  }

  /** Saves one sync-kind switch immediately, mirroring useReadingServices.setFeature's optimistic update with rollback. */
  async function setSyncKind(kind: TkSyncKind, value: boolean): Promise<boolean> {
    const previous = settings.value?.[kind]
    if (settings.value) settings.value[kind] = value

    savingSyncKind.value = kind
    error.value = null
    try {
      settings.value = await upsertTkSettings({ [kind]: value })
      return true
    } catch (err) {
      if (settings.value && previous !== undefined) settings.value[kind] = previous
      error.value = err instanceof Error ? err.message : 'Failed to update sync settings'
      return false
    } finally {
      savingSyncKind.value = null
    }
  }

  async function previewBackfill(): Promise<TkBackfillPreview | null> {
    try {
      return await previewTkBackfill()
    } catch {
      return null
    }
  }

  async function startBackfill(): Promise<boolean> {
    saving.value = true
    try {
      settings.value = await requestTkBackfill()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start backfill'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    settings,
    loading,
    saving,
    connecting,
    error,
    savingSyncKind,
    fetchSettings,
    saveSettings,
    connectStart,
    connectFinish,
    disconnect,
    previewBackfill,
    startBackfill,
    setSyncKind,
  }
}
