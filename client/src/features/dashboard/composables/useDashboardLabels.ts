import { useI18n } from 'vue-i18n'

import type { ReadingServiceProvider, ReadingServiceShelf, ScrollerConfig, ScrollerType, WidgetType } from '@bookorbit/types'
import type { MessageSchema } from '@/i18n'

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

  function externalShelfProviderName(provider: ReadingServiceProvider): string {
    return t(`dashboard.externalShelves.providerNames.${EXTERNAL_SHELF_PROVIDER_KEYS[provider]}`)
  }

  function externalShelfName(shelf: ReadingServiceShelf): string {
    return t(`dashboard.externalShelves.shelfNames.${EXTERNAL_SHELF_NAME_KEYS[shelf]}`)
  }

  /** Composed title for a generic provider shelf, e.g. "Hardcover: Trending", used by both the dashboard and the picker. */
  function externalShelfTitle(provider: ReadingServiceProvider, shelf: ReadingServiceShelf): string {
    return t('dashboard.externalShelves.title', { provider: externalShelfProviderName(provider), shelf: externalShelfName(shelf) })
  }

  function externalShelfDescription(provider: ReadingServiceProvider): string {
    return t('dashboard.externalShelves.description', { provider: externalShelfProviderName(provider) })
  }

  return {
    widgetName,
    shelfTypeName,
    shelfTitle,
    externalShelfProviderName,
    externalShelfName,
    externalShelfTitle,
    externalShelfDescription,
  }
}
