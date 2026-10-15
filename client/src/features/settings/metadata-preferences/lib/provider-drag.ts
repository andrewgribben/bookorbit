import type { MetadataFieldSourceKey } from '@bookorbit/types'

export interface ProviderDragItem {
  key: MetadataFieldSourceKey
  dragId: string
}

export const PROVIDER_DND_GROUP = 'metadata-preferences-provider'

let providerDragId = 0

export function createProviderDragItem(key: MetadataFieldSourceKey): ProviderDragItem {
  providerDragId += 1
  return { key, dragId: `${key}:${providerDragId}` }
}

export function toProviderDragItems(providers: MetadataFieldSourceKey[]): ProviderDragItem[] {
  return providers.map((key) => createProviderDragItem(key))
}

export function normalizeProviderOrder(items: ProviderDragItem[]): MetadataFieldSourceKey[] {
  const next: MetadataFieldSourceKey[] = []
  const seen = new Set<MetadataFieldSourceKey>()
  for (const item of items) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    next.push(item.key)
  }
  return next
}
