import { computed, ref, watch } from 'vue'

import {
  SCROLLER_TYPES,
  type DashboardShelfConfig,
  type DashboardShelfLayout,
  type ExternalShelfConfig,
  type ScrollerConfig,
  type ScrollerType,
} from '@bookorbit/types'
import { useAuth } from '@/features/auth/composables/useAuth'
import { usePermissions } from '@/features/auth/composables/usePermissions'
import { api } from '@/lib/api'
import { normalizeShelfRows } from '../lib/shelf-rows'
import { mergeShelfRows, splitShelfRows, type ShelfOrderVersion } from '../lib/shelf-order'

const STORAGE_KEY = 'bookorbit:dashboard:config'
const MAX_SCROLLERS = 8
const MAX_EXTERNAL_SHELVES = 16

export const SHELF_LAYOUT = {
  WIDE: 'wide',
  TWO_COLUMNS: 'two-columns',
} as const

export type { DashboardShelfLayout } from '@bookorbit/types'

interface StoredDashboardConfig {
  scrollers: ScrollerConfig[]
  shelfLayout: DashboardShelfLayout
  externalShelves: ExternalShelfConfig[]
  shelfOrderVersion?: ShelfOrderVersion
}

export const DEFAULT_SCROLLERS: ScrollerConfig[] = [
  { id: '2', type: 'recently-added', label: 'Recently Added', enabled: true, order: 1, limit: 20, rows: 1 },
  { id: '3', type: 'random', label: 'Discover Something New', enabled: true, order: 2, limit: 20, rows: 1 },
  { id: '1', type: 'continue-reading', label: 'Continue Reading', enabled: true, order: 3, limit: 20, rows: 1 },
  { id: '5', type: 'continue-listening', label: 'Continue Listening', enabled: true, order: 4, limit: 20, rows: 1 },
  { id: '6', type: 'want-to-read', label: 'Want to Read', enabled: false, order: 5, limit: 20, rows: 1 },
  { id: '4', type: 'up-next-in-series', label: 'Up Next in Series', enabled: false, order: 6, limit: 20, rows: 1, maxAgeMonths: 12 },
]

// Persisted-only. Shelf headings and the type selector resolve their text from the active
// locale via useDashboardLabels(); these values just keep stored configs shaped as before.
export const SCROLLER_LABELS: Record<ScrollerType, string> = {
  'continue-reading': 'Continue Reading',
  'continue-listening': 'Continue Listening',
  'want-to-read': 'Want to Read',
  'up-next-in-series': 'Up Next in Series',
  'recently-added': 'Recently Added',
  random: 'Discover Something New',
  'smart-scope': 'Smart Scope',
}

/** Absent maxAgeMonths means no cut-off, which is how configs saved before the option load. */
export const UP_NEXT_CUTOFF_MONTHS = [3, 6, 12, 24] as const

/** Stored configs can name shelves this client no longer has; those are dropped on read and never written back. */
const VALID_SCROLLER_TYPES = new Set<ScrollerType>(SCROLLER_TYPES)
// Private adapters (for example `readwise-social`) register their own provider and shelf ids at
// runtime, so persisted entries are checked for shape, not against the built-in lists.
const EXTERNAL_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

function cloneDefaultScrollers(): ScrollerConfig[] {
  return DEFAULT_SCROLLERS.map((scroller) => ({ ...scroller }))
}

function parseStoredScrollers(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return null

  const { scrollers } = value as { scrollers?: unknown }
  return Array.isArray(scrollers) ? scrollers : null
}

function normalizeShelfLayout(value: unknown): DashboardShelfLayout {
  return value === SHELF_LAYOUT.TWO_COLUMNS ? SHELF_LAYOUT.TWO_COLUMNS : SHELF_LAYOUT.WIDE
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function normalizeShelfOrderVersion(value: unknown): ShelfOrderVersion {
  return value === 2 ? 2 : undefined
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

function normalizeSmartScopeId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function normalizeMaxAgeMonths(value: unknown): number | undefined {
  return (UP_NEXT_CUTOFF_MONTHS as readonly unknown[]).includes(value) ? (value as number) : undefined
}

function normalizeId(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function normalizeScroller(value: unknown, index: number): ScrollerConfig | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<ScrollerConfig> & { type?: unknown }
  if (typeof raw.type !== 'string' || !VALID_SCROLLER_TYPES.has(raw.type as ScrollerType)) return null

  const type = raw.type as ScrollerType
  const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : SCROLLER_LABELS[type]
  const smartScopeId = type === 'smart-scope' ? normalizeSmartScopeId(raw.smartScopeId) : undefined
  const maxAgeMonths = type === 'up-next-in-series' ? normalizeMaxAgeMonths(raw.maxAgeMonths) : undefined

  return {
    id: normalizeId(raw.id, String(index + 1)),
    type,
    label,
    enabled: normalizeBoolean(raw.enabled, true),
    order: normalizePositiveNumber(raw.order, index + 1),
    limit: normalizePositiveNumber(raw.limit, 20),
    rows: normalizeShelfRows(raw.rows),
    ...(smartScopeId === undefined ? {} : { smartScopeId }),
    ...(maxAgeMonths === undefined ? {} : { maxAgeMonths }),
  }
}

/**
 * `version === 2` means `order` already sits in the one sequence shared with external shelves,
 * so it is kept as parsed. Any other version reindexes to a gap-free 1..N within this array
 * alone, which is what every scroller-only caller (and the pre-unification format) expects.
 */
function normalizeScrollers(value: unknown, version: ShelfOrderVersion = undefined): ScrollerConfig[] {
  const storedScrollers = parseStoredScrollers(value)
  if (!storedScrollers) return cloneDefaultScrollers()

  const normalized = storedScrollers
    .map((scroller, index) => normalizeScroller(scroller, index))
    .filter((scroller): scroller is ScrollerConfig => scroller !== null)
    .slice(0, MAX_SCROLLERS)

  if (normalized.length === 0) return cloneDefaultScrollers()
  if (version === 2) return normalized
  return normalized.map((scroller, index) => ({ ...scroller, order: index + 1 }))
}

/**
 * External shelves (owner decision 1, "Customize Dashboard picker for provider shelves"): a
 * separate persisted list from `scrollers`, since a provider shelf is not a `ScrollerType` and
 * has no stored label - its title is resolved per (provider, shelf) through
 * `useDashboardLabels`, not a string written here. Unlike scrollers there is no built-in
 * default list: which shelves exist depends on which providers the user has connected, so the
 * picker (`useExternalShelves`) seeds this on first load instead.
 */
function normalizeExternalShelf(value: unknown, index: number): ExternalShelfConfig | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ExternalShelfConfig>
  if (typeof raw.provider !== 'string' || !EXTERNAL_ID_PATTERN.test(raw.provider)) return null
  if (typeof raw.shelf !== 'string' || !EXTERNAL_ID_PATTERN.test(raw.shelf)) return null

  return {
    provider: raw.provider as ExternalShelfConfig['provider'],
    shelf: raw.shelf as ExternalShelfConfig['shelf'],
    enabled: normalizeBoolean(raw.enabled, false),
    order: normalizePositiveNumber(raw.order, index + 1),
  }
}

/** Same version-aware order handling as `normalizeScrollers`, see its comment. */
function normalizeExternalShelves(value: unknown, version: ShelfOrderVersion = undefined): ExternalShelfConfig[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const normalized = value
    .map((shelf, index) => normalizeExternalShelf(shelf, index))
    .filter((shelf): shelf is ExternalShelfConfig => shelf !== null)
    .filter((shelf) => {
      const key = `${shelf.provider}:${shelf.shelf}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_EXTERNAL_SHELVES)

  if (version === 2) return normalized
  return normalized.map((shelf, index) => ({ ...shelf, order: index + 1 }))
}

function loadConfig(): StoredDashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { scrollers: cloneDefaultScrollers(), shelfLayout: SHELF_LAYOUT.WIDE, externalShelves: [], shelfOrderVersion: undefined }

    const parsed: unknown = JSON.parse(raw)
    const isObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    const shelfOrderVersion = isObject ? normalizeShelfOrderVersion((parsed as { shelfOrderVersion?: unknown }).shelfOrderVersion) : undefined
    const shelfLayout = isObject ? normalizeShelfLayout((parsed as { shelfLayout?: unknown }).shelfLayout) : SHELF_LAYOUT.WIDE
    const externalShelves = isObject ? normalizeExternalShelves((parsed as { externalShelves?: unknown }).externalShelves, shelfOrderVersion) : []

    return { scrollers: normalizeScrollers(parsed, shelfOrderVersion), shelfLayout, externalShelves, shelfOrderVersion }
  } catch {
    return { scrollers: cloneDefaultScrollers(), shelfLayout: SHELF_LAYOUT.WIDE, externalShelves: [], shelfOrderVersion: undefined }
  }
}

function areScrollersEqual(left: ScrollerConfig[], right: ScrollerConfig[]): boolean {
  if (left.length !== right.length) return false
  return left.every((scroller, index) => {
    const other = right[index]
    if (!other) return false
    return (
      scroller.id === other.id &&
      scroller.type === other.type &&
      scroller.label === other.label &&
      scroller.enabled === other.enabled &&
      scroller.order === other.order &&
      scroller.limit === other.limit &&
      scroller.rows === other.rows &&
      scroller.smartScopeId === other.smartScopeId
    )
  })
}

// Module-level singletons - all callers share the same reactive state
const initialConfig = loadConfig()
const scrollers = ref<ScrollerConfig[]>(initialConfig.scrollers)
const shelfLayout = ref<DashboardShelfLayout>(initialConfig.shelfLayout)
const externalShelves = ref<ExternalShelfConfig[]>(initialConfig.externalShelves)
const shelfOrderVersion = ref<ShelfOrderVersion>(initialConfig.shelfOrderVersion)
let hydratedUserId: number | undefined
let hydratedFromServer = false

export function useDashboardConfig() {
  const { user } = useAuth()
  const { isDemoRestrictedAccount } = usePermissions()
  const syncAcrossSessions = computed(() => !isDemoRestrictedAccount.value && user.value?.settings?.dashboardShelfConfig?.syncAcrossSessions === true)

  watch(
    () => [user.value?.id, user.value?.settings?.dashboardShelfConfig, isDemoRestrictedAccount.value] as const,
    ([userId, config, demoRestricted]) => {
      if (!demoRestricted && config?.syncAcrossSessions === true) {
        const version = normalizeShelfOrderVersion(config.shelfOrderVersion)
        scrollers.value = normalizeScrollers(config.scrollers, version)
        shelfLayout.value = normalizeShelfLayout(config.shelfLayout)
        externalShelves.value = normalizeExternalShelves(config.externalShelves, version)
        shelfOrderVersion.value = version
      } else if (hydratedUserId !== userId || hydratedFromServer) {
        const local = loadConfig()
        scrollers.value = local.scrollers
        shelfLayout.value = local.shelfLayout
        externalShelves.value = local.externalShelves
        shelfOrderVersion.value = local.shelfOrderVersion
      }
      hydratedUserId = userId
      hydratedFromServer = !demoRestricted && config?.syncAcrossSessions === true
    },
    { immediate: true, flush: 'sync' },
  )

  function save() {
    scrollers.value = normalizeScrollers(scrollers.value, shelfOrderVersion.value)
    shelfLayout.value = normalizeShelfLayout(shelfLayout.value)
    externalShelves.value = normalizeExternalShelves(externalShelves.value, shelfOrderVersion.value)
    if (syncAcrossSessions.value) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scrollers: scrollers.value,
        shelfLayout: shelfLayout.value,
        externalShelves: externalShelves.value,
        shelfOrderVersion: shelfOrderVersion.value,
      } satisfies StoredDashboardConfig),
    )
  }

  function saveScrollers(newScrollers: ScrollerConfig[]) {
    scrollers.value = normalizeScrollers(newScrollers, shelfOrderVersion.value)
    save()
  }

  async function saveShelfSettings(
    newScrollers: ScrollerConfig[],
    newShelfLayout: DashboardShelfLayout,
    sync = syncAcrossSessions.value,
    newExternalShelves: ExternalShelfConfig[] = externalShelves.value,
    newShelfOrderVersion: ShelfOrderVersion = 2,
  ) {
    sync = sync && !isDemoRestrictedAccount.value
    const nextScrollers = normalizeScrollers(newScrollers, newShelfOrderVersion)
    const nextLayout = normalizeShelfLayout(newShelfLayout)
    const nextExternalShelves = normalizeExternalShelves(newExternalShelves, newShelfOrderVersion)
    if (sync || syncAcrossSessions.value) {
      const currentUser = user.value
      if (!currentUser) throw new Error('Sign in to sync dashboard shelves')
      const config: DashboardShelfConfig = {
        syncAcrossSessions: sync,
        scrollers: nextScrollers,
        shelfLayout: nextLayout,
        externalShelves: nextExternalShelves,
        shelfOrderVersion: newShelfOrderVersion,
      }
      const response = await api('/api/v1/users/me/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { dashboardShelfConfig: config } }),
      })
      if (!response.ok) throw new Error(`Failed to save dashboard shelves: ${response.status}`)
      if (user.value?.id !== currentUser.id) return
      user.value = { ...user.value, settings: { ...user.value.settings, dashboardShelfConfig: config } }
    }
    scrollers.value = nextScrollers
    shelfLayout.value = nextLayout
    externalShelves.value = nextExternalShelves
    shelfOrderVersion.value = newShelfOrderVersion
    save()
  }

  function addScroller(type: ScrollerType) {
    scrollers.value = normalizeScrollers(scrollers.value, shelfOrderVersion.value)
    if (scrollers.value.length >= MAX_SCROLLERS) return
    const maxId = Math.max(0, ...scrollers.value.map((s) => Number(s.id)))
    const maxOrder = Math.max(0, ...scrollers.value.map((s) => s.order), ...externalShelves.value.map((s) => s.order))
    scrollers.value.push({
      id: String(maxId + 1),
      type,
      label: SCROLLER_LABELS[type],
      enabled: true,
      order: maxOrder + 1,
      limit: 20,
      rows: 1,
    })
    save()
  }

  /**
   * Removing a smart-scope scroller can leave the shared order sequence (version 2) with a
   * gap. Re-merging and re-splitting both arrays closes it without disturbing either array's
   * relative order; in a legacy config, where the arrays never shared one sequence, the
   * scrollers are simply reindexed on their own as before.
   */
  function pruneDeletedSmartScopeScrollers(validSmartScopeIds: readonly number[]) {
    const validIds = new Set(validSmartScopeIds.filter((id) => Number.isFinite(id) && id > 0))
    const filtered = scrollers.value.filter((scroller) => {
      if (scroller.type !== 'smart-scope') return true
      if (!scroller.smartScopeId) return false
      return validIds.has(scroller.smartScopeId)
    })

    let next = filtered
    let nextExternal = externalShelves.value
    if (shelfOrderVersion.value === 2) {
      const split = splitShelfRows(mergeShelfRows(filtered, externalShelves.value, 2))
      next = split.scrollers
      nextExternal = split.externalShelves
    } else {
      next = filtered.map((scroller, index) => ({ ...scroller, order: index + 1 }))
    }

    if (areScrollersEqual(scrollers.value, next) && nextExternal === externalShelves.value) return
    scrollers.value = next
    externalShelves.value = nextExternal
    save()
  }

  /**
   * Adds a default entry for an available (provider, shelf) pair the persisted list does not
   * have yet, defaulted per owner decision 1: `owned-elsewhere` starts enabled only when
   * `defaultEnabled` says the provider is connected and its `owned` feature is on; every other
   * shelf starts off until the user turns it on from the picker. A no-op when the pair is
   * already present, so re-running this on every available-shelves fetch is safe. The new row's
   * order is the highest order across both arrays plus one, so it lands at the end of the
   * effective merged order whatever the config's shelfOrderVersion.
   */
  function ensureExternalShelf(provider: ExternalShelfConfig['provider'], shelf: ExternalShelfConfig['shelf'], defaultEnabled: boolean) {
    const exists = externalShelves.value.some((entry) => entry.provider === provider && entry.shelf === shelf)
    if (exists) return
    const maxOrder = Math.max(0, ...scrollers.value.map((s) => s.order), ...externalShelves.value.map((s) => s.order))
    externalShelves.value = [...externalShelves.value, { provider, shelf, enabled: defaultEnabled, order: maxOrder + 1 }]
    save()
  }

  function reset() {
    scrollers.value = cloneDefaultScrollers()
    shelfLayout.value = SHELF_LAYOUT.WIDE
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    scrollers,
    shelfLayout,
    externalShelves,
    shelfOrderVersion,
    syncAcrossSessions,
    saveScrollers,
    saveShelfSettings,
    addScroller,
    pruneDeletedSmartScopeScrollers,
    ensureExternalShelf,
    reset,
    MAX_SCROLLERS,
    MAX_EXTERNAL_SHELVES,
  }
}
