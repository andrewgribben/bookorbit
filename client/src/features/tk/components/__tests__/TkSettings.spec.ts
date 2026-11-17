import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { TkBackfillPreview, TkSettings } from '@bookorbit/types'
import TkSettingsPage from '../TkSettings.vue'

const settings = ref<TkSettings | null>(null)
const error = ref<string | null>(null)

const {
  fetchSettings,
  saveSettings,
  connectStart,
  connectFinish,
  disconnect,
  previewBackfill,
  startBackfill,
  setSyncKind,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  fetchSettings: vi.fn<() => Promise<void>>(),
  saveSettings: vi.fn<(payload: unknown) => Promise<boolean>>(),
  connectStart: vi.fn<() => Promise<string | null>>(),
  connectFinish: vi.fn<(url: string) => Promise<boolean>>(),
  disconnect: vi.fn<() => Promise<boolean>>(),
  previewBackfill: vi.fn<() => Promise<TkBackfillPreview | null>>(),
  startBackfill: vi.fn<() => Promise<boolean>>(),
  setSyncKind: vi.fn<(kind: string, value: boolean) => Promise<boolean>>(),
  toastSuccess: vi.fn<(message: string) => void>(),
  toastError: vi.fn<(message: string) => void>(),
}))

vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

const savingSyncKind = ref<string | null>(null)

vi.mock('../../composables/useTkSettings', () => ({
  useTkSettings: () => ({
    settings,
    loading: ref(false),
    saving: ref(false),
    connecting: ref(false),
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
  }),
}))

beforeEach(() => {
  settings.value = null
  error.value = null
  savingSyncKind.value = null
  fetchSettings.mockReset().mockResolvedValue(undefined)
  saveSettings.mockReset().mockResolvedValue(true)
  connectStart.mockReset().mockResolvedValue('https://tk.xyz/oauth/authorize?x=1')
  connectFinish.mockReset().mockResolvedValue(true)
  disconnect.mockReset().mockResolvedValue(true)
  previewBackfill.mockReset().mockResolvedValue(null)
  startBackfill.mockReset().mockResolvedValue(true)
  setSyncKind.mockReset().mockResolvedValue(true)
  toastSuccess.mockReset()
  toastError.mockReset()
  vi.stubGlobal('open', vi.fn())
})

function baseSettings(overrides: Partial<TkSettings> = {}): TkSettings {
  return {
    connected: false,
    enabled: false,
    effectiveEnabled: false,
    disabledReason: null,
    lastSyncedAt: null,
    connectedAt: null,
    backfillRequestedAt: null,
    syncAnnotations: true,
    syncJournal: true,
    syncFinished: true,
    ...overrides,
  }
}

function findButton(wrapper: Awaited<ReturnType<typeof mountPage>>, label: string) {
  const btn = wrapper.findAll('button').find((b) => b.text().trim() === label)
  if (!btn) throw new Error(`button "${label}" not found`)
  return btn
}

async function mountPage() {
  const wrapper = mount(TkSettingsPage)
  await flushPromises()
  return wrapper
}

describe('TkSettings.vue', () => {
  it('shows a Connect TK button when not connected', async () => {
    settings.value = baseSettings()
    const wrapper = await mountPage()
    expect(findButton(wrapper, 'Connect TK')).toBeTruthy()
    expect(wrapper.find('[data-testid="tk-connected-row"]').exists()).toBe(false)
  })

  it('opens the authorise URL in a new tab and shows the paste-back field after connect start', async () => {
    settings.value = baseSettings()
    const wrapper = await mountPage()
    await findButton(wrapper, 'Connect TK').trigger('click')
    await flushPromises()

    expect(connectStart).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('https://tk.xyz/oauth/authorize?x=1', '_blank', 'noopener')
    expect(wrapper.find('#tk-callback-url').exists()).toBe(true)
  })

  it('shows the connected row and a disconnect button once connected', async () => {
    settings.value = baseSettings({ connected: true })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="tk-connected-row"]').exists()).toBe(true)
    expect(findButton(wrapper, 'Disconnect')).toBeTruthy()
  })

  it('shows the backfill card with the preview counts once connected', async () => {
    settings.value = baseSettings({ connected: true })
    previewBackfill.mockResolvedValue({ itemCount: 42, dayCount: 7, oldestDateKey: '2020-01-01' })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="tk-backfill-card"]').text()).toContain('42 items across 7 days')
  })

  it('does not show the backfill card before connecting', async () => {
    settings.value = baseSettings({ connected: false })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="tk-backfill-card"]').exists()).toBe(false)
  })

  it('starting a backfill calls the composable and shows a toast', async () => {
    settings.value = baseSettings({ connected: true })
    previewBackfill.mockResolvedValue({ itemCount: 10, dayCount: 2, oldestDateKey: '2021-01-01' })
    const wrapper = await mountPage()
    await findButton(wrapper, 'Send history to TK').trigger('click')
    await flushPromises()
    expect(startBackfill).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('shows the What syncs section with three rows once connected', async () => {
    settings.value = baseSettings({ connected: true })
    const wrapper = await mountPage()
    const section = wrapper.find('[data-testid="tk-what-syncs-section"]')
    expect(section.exists()).toBe(true)
    expect(section.findAll('[role="switch"]')).toHaveLength(3)
    expect(section.text()).toContain('Highlights and notes')
    expect(section.text()).toContain('Journal entries')
    expect(section.text()).toContain('Finished books')
    expect(section.findAll('[role="switch"]').every((s) => s.text() === '' && section.text().includes('To TK'))).toBe(true)
  })

  it('does not show the What syncs section before connecting', async () => {
    settings.value = baseSettings({ connected: false })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="tk-what-syncs-section"]').exists()).toBe(false)
  })

  it('toggling a row saves that single field immediately', async () => {
    settings.value = baseSettings({ connected: true, syncJournal: true })
    const wrapper = await mountPage()
    await wrapper.get('#tk-sync-syncJournal').trigger('click')
    await flushPromises()
    expect(setSyncKind).toHaveBeenCalledWith('syncJournal', false)
  })

  it('shows an error toast and leaves the other rows alone when a toggle fails', async () => {
    settings.value = baseSettings({ connected: true, syncAnnotations: true })
    setSyncKind.mockResolvedValue(false)
    error.value = 'Failed to update sync settings'
    const wrapper = await mountPage()
    await wrapper.get('#tk-sync-syncAnnotations').trigger('click')
    await flushPromises()
    expect(setSyncKind).toHaveBeenCalledWith('syncAnnotations', false)
    expect(toastError).toHaveBeenCalledWith('Failed to update sync settings')
  })

  it('disables a row switch while it is saving', async () => {
    settings.value = baseSettings({ connected: true })
    savingSyncKind.value = 'syncFinished'
    const wrapper = await mountPage()
    expect(wrapper.get('#tk-sync-syncFinished').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#tk-sync-syncAnnotations').attributes('disabled')).toBeUndefined()
  })
})
