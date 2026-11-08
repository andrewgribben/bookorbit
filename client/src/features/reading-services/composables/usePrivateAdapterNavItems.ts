import { computed, onMounted } from 'vue'
import type { SettingsNavItem } from '@/features/settings/lib/settings-nav'
import { useReadingServices } from './useReadingServices'
import { createAdapterIconComponent } from './reading-service-adapter-icon'

/** Built-ins keep their own static nav entries; only a private adapter needs a dynamic one. */
const BUILT_IN_PROVIDERS = new Set(['readwise', 'hardcover', 'storygraph'])

/**
 * One `SettingsNavItem` per connected-or-not private adapter, built from whatever
 * `GET /reading-services` currently reports. `displayName` is used directly as `labelKey`
 * (see `settings-nav.ts`'s `mergeDynamicAccountItems` doc comment for why that needs no
 * en.json entry): vue-i18n falls back to returning an unknown key verbatim.
 */
export function usePrivateAdapterNavItems() {
  const { summaries, fetchSummaries } = useReadingServices()

  onMounted(() => {
    void fetchSummaries()
  })

  const items = computed<SettingsNavItem[]>(() =>
    summaries.value
      .filter((summary) => summary.authMethods !== undefined && !BUILT_IN_PROVIDERS.has(summary.provider))
      .map((summary) => ({
        id: `reading-service-${summary.provider}`,
        routeName: 'settings-reading-service',
        routeParams: { provider: summary.provider },
        labelKey: summary.displayName || summary.provider,
        icon: createAdapterIconComponent(summary.iconUrl),
        keywords: `${summary.provider} reading service private adapter integration`,
      })),
  )

  return { items }
}
