import type { DashboardShelfConfig, ExternalShelfConfig, ScrollerConfig } from '@bookorbit/types'

export type ShelfOrderVersion = DashboardShelfConfig['shelfOrderVersion']

export type MixedShelfRow =
  { kind: 'scroller'; id: string; scroller: ScrollerConfig } | { kind: 'external'; id: string; external: ExternalShelfConfig }

export function scrollerRow(scroller: ScrollerConfig): MixedShelfRow {
  return { kind: 'scroller', id: `scroller:${scroller.id}`, scroller }
}

export function externalRow(external: ExternalShelfConfig): MixedShelfRow {
  return { kind: 'external', id: `external:${external.provider}:${external.shelf}`, external }
}

export function isScrollerRow(row: MixedShelfRow): row is { kind: 'scroller'; id: string; scroller: ScrollerConfig } {
  return row.kind === 'scroller'
}

export function isExternalRow(row: MixedShelfRow): row is { kind: 'external'; id: string; external: ExternalShelfConfig } {
  return row.kind === 'external'
}

function rowOrder(row: MixedShelfRow): number {
  return row.kind === 'scroller' ? row.scroller.order : row.external.order
}

/**
 * Builds the single ordered list the Customize sheet drags and the dashboard renders from.
 * `shelfOrderVersion` 2 means `scrollers[].order` and `externalShelves[].order` already share
 * one sequence, so the merged list is just both arrays sorted by that shared `order`. Any other
 * value (legacy: the field is absent) means the two arrays were never put in one sequence, so
 * the only order that is meaningful is the pre-unification arrangement the dashboard always
 * rendered: every external shelf first in its own order, then every scroller in its own order.
 * This is the one place that reads `order` across both kinds, so the legacy fallback only has
 * to be right here.
 */
export function mergeShelfRows(
  scrollers: ScrollerConfig[],
  externalShelves: ExternalShelfConfig[],
  shelfOrderVersion: ShelfOrderVersion,
): MixedShelfRow[] {
  const scrollerRows = scrollers.map(scrollerRow)
  const externalRows = externalShelves.map(externalRow)

  if (shelfOrderVersion === 2) {
    return [...scrollerRows, ...externalRows].sort((a, b) => rowOrder(a) - rowOrder(b))
  }

  return [...externalRows.slice().sort((a, b) => rowOrder(a) - rowOrder(b)), ...scrollerRows.slice().sort((a, b) => rowOrder(a) - rowOrder(b))]
}

/**
 * Renumbers a mixed row list into one shared sequence (1..N, no gaps) and splits it back into
 * the two stored arrays with `shelfOrderVersion: 2`. Called on every save, so any config this
 * touches - including a legacy one with no shared sequence yet - comes out migrated.
 */
export function splitShelfRows(rows: MixedShelfRow[]): { scrollers: ScrollerConfig[]; externalShelves: ExternalShelfConfig[]; shelfOrderVersion: 2 } {
  const scrollers: ScrollerConfig[] = []
  const externalShelves: ExternalShelfConfig[] = []

  rows.forEach((row, index) => {
    const order = index + 1
    if (row.kind === 'scroller') scrollers.push({ ...row.scroller, order })
    else externalShelves.push({ ...row.external, order })
  })

  return { scrollers, externalShelves, shelfOrderVersion: 2 }
}
