import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ReadingServiceProvider, ReadingServiceShelf, ScrollerConfig, ScrollerType, WidgetType } from '@bookorbit/types'
import type { MessageSchema } from '@/i18n'
import { useReadingServices } from '@/features/reading-services/composables/useReadingServices'

type WidgetNameKey = keyof MessageSchema['dashboard']['settings']['widgetNames']
type ShelfNameKey = keyof MessageSchema['dashboard']['settings']['shelfNames']
type ExternalShelfNameKey = keyof MessageSchema['dashboard']['externalShelves']['shelfNames']
type ExternalShelfProviderKey = keyof MessageSchema['dashboard']['externalShelves']['providerNames']

// Typed against the English catalog so a renamed or removed message fails typecheck
// instead of silently rendering a raw key path.
const WIDGET_NAME_KEYS: Record<WidgetType, WidgetNameKey> = {
  'reading-streak': 'readingStreak',
  'currently-reading': 'currentlyReading',
  'reading-goal': 'readingGoal',
  'reading-dna': 'readingDna',
  'monthly-challenge': 'monthlyChallenge',
  'highlight-of-the-day': 'highlightOfTheDay',
  'neglected-gems': 'neglectedGems',
  'reading-rhythm': 'readingRhythm',
  'diversity-score': 'diversityScore',
  'library-overview': 'libraryOverview',
  'year-projection': 'yearProjection',
  'long-wait': 'longWait',
  'reading-recap': 'readingRecap',
}

const SHELF_NAME_KEYS: Record<ScrollerType, ShelfNameKey> = {
  'recently-added': 'recentlyAdded',
  'continue-reading': 'continueReading',
  'continue-listening': 'continueListening',
  'want-to-read': 'wantToRead',
  'up-next-in-series': 'upNextInSeries',
  random: 'random',
  'smart-scope': 'smartScope',
}

const EXTERNAL_SHELF_NAME_KEYS: Record<ReadingServiceShelf, ExternalShelfNameKey> = {
  'friends-reading': 'friendsReading',
  'friends-finished': 'friendsFinished',
  trending: 'trending',
  recommendations: 'recommendations',
  'owned-elsewhere': 'ownedElsewhere',
}

const EXTERNAL_SHELF_PROVIDER_KEYS: Record<ReadingServiceProvider, ExternalShelfProviderKey> = {
  readwise: 'readwise',
  hardcover: 'hardcover',
}

export function useDashboardLabels() {
  const { t } = useI18n()
  const { getSummary, fetchSummaries } = useReadingServices()

  // Needed only for externalShelfProviderName's unknown-provider fallback (a private adapter's
  // displayName). Harmless no-op network call for the common case where every shelf is
  // built-in, and consistent with how every other reading-services consumer refreshes this
  // shared state (see ReadingServiceSettings.vue, usePrivateAdapterNavItems).
  onMounted(() => {
    void fetchSummaries()
  })

  function widgetName(type: WidgetType): string {
    return t(`dashboard.settings.widgetNames.${WIDGET_NAME_KEYS[type]}`)
  }

  function shelfTypeName(type: ScrollerType): string {
    return t(`dashboard.settings.shelfNames.${SHELF_NAME_KEYS[type]}`)
  }

  // A Smart Scope shelf is titled with the user's own scope name, which is content and stays
  // untranslated. Every other shelf resolves from its type: the persisted `label` predates
  // localization and holds a fixed English string that would survive a language change.
  function shelfTitle(scroller: ScrollerConfig): string {
    if (scroller.type !== 'smart-scope') return shelfTypeName(scroller.type)
    const smartScopeName = scroller.smartScopeId ? scroller.label.trim() : ''
    return smartScopeName || shelfTypeName('smart-scope')
  }

  // `provider` is widened to `string`: built-in providers (readwise, hardcover) match a known
  // translation key, but private adapters (e.g. a friends/social adapter) report their own id
  // and are never in `EXTERNAL_SHELF_PROVIDER_KEYS` -- falling through to `t()` with an
  // `undefined` key previously rendered the raw key path verbatim (owner bug report). Fall back
  // to the provider's own summary `displayName`, then its bare id, same precedence as
  // `usePrivateAdapterNavItems`.
  function externalShelfProviderName(provider: string): string {
    const key = EXTERNAL_SHELF_PROVIDER_KEYS[provider as ReadingServiceProvider]
    if (key) return t(`dashboard.externalShelves.providerNames.${key}`)
    return getSummary(provider as ReadingServiceProvider).value?.displayName || provider
  }

  function externalShelfName(shelf: ReadingServiceShelf): string {
    return t(`dashboard.externalShelves.shelfNames.${EXTERNAL_SHELF_NAME_KEYS[shelf]}`)
  }

  // A private adapter id is often a built-in provider with a suffix (e.g. `readwise-social`, a
  // friends adapter riding on Readwise's own API). "View in <provider>" should name the actual
  // site the link opens on ("Readwise"), not the adapter's own display name ("Readwise
  // friends"), so this checks the part before the first hyphen against the built-in map before
  // falling back to `externalShelfProviderName`'s displayName/bare-id fallback.
  function externalShelfViewInProviderName(provider: string): string {
    const base = provider.split('-')[0]
    const key = EXTERNAL_SHELF_PROVIDER_KEYS[base as ReadingServiceProvider]
    return key ? t(`dashboard.externalShelves.providerNames.${key}`) : externalShelfProviderName(provider)
  }

  /**
   * Composed title for a shelf, e.g. "Hardcover: Trending" for a built-in provider, used by
   * both the dashboard and the picker. A private adapter (not in `EXTERNAL_SHELF_PROVIDER_KEYS`,
   * e.g. a friends/social adapter) drops the provider prefix and shows just the shelf name, since
   * its own settings section already names the provider.
   */
  function externalShelfTitle(provider: string, shelf: ReadingServiceShelf): string {
    const key = EXTERNAL_SHELF_PROVIDER_KEYS[provider as ReadingServiceProvider]
    if (!key) return externalShelfName(shelf)
    return t('dashboard.externalShelves.title', { provider: externalShelfProviderName(provider), shelf: externalShelfName(shelf) })
  }

  function externalShelfDescription(provider: string): string {
    return t('dashboard.externalShelves.description', { provider: externalShelfProviderName(provider) })
  }

  return {
    widgetName,
    shelfTypeName,
    shelfTitle,
    externalShelfProviderName,
    externalShelfViewInProviderName,
    externalShelfName,
    externalShelfTitle,
    externalShelfDescription,
  }
}
