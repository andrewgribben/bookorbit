import { describe, expect, it } from 'vitest'
import type { ExternalShelfConfig, ScrollerConfig } from '@bookorbit/types'
import { isExternalRow, isScrollerRow, mergeShelfRows, splitShelfRows } from '../shelf-order'

function scroller(id: string, order: number): ScrollerConfig {
  return { id, type: 'recently-added', label: 'Recently Added', enabled: true, order, limit: 20, rows: 1 }
}

function external(shelf: string, order: number): ExternalShelfConfig {
  return { provider: 'readwise', shelf: shelf as ExternalShelfConfig['shelf'], enabled: true, order }
}

describe('mergeShelfRows', () => {
  it('puts every external shelf before every scroller for a legacy (undefined) config', () => {
    const rows = mergeShelfRows([scroller('1', 1), scroller('2', 2)], [external('owned-elsewhere', 1), external('trending', 2)], undefined)

    expect(rows.map((row) => row.id)).toEqual(['external:readwise:owned-elsewhere', 'external:readwise:trending', 'scroller:1', 'scroller:2'])
  })

  it('sorts both kinds by their own order within the legacy fallback', () => {
    const rows = mergeShelfRows([scroller('2', 2), scroller('1', 1)], [external('trending', 2), external('owned-elsewhere', 1)], undefined)

    expect(rows.map((row) => row.id)).toEqual(['external:readwise:owned-elsewhere', 'external:readwise:trending', 'scroller:1', 'scroller:2'])
  })

  it('interleaves both kinds by their shared order when shelfOrderVersion is 2', () => {
    const rows = mergeShelfRows([scroller('1', 1), scroller('2', 3)], [external('owned-elsewhere', 2)], 2)

    expect(rows.map((row) => row.id)).toEqual(['scroller:1', 'external:readwise:owned-elsewhere', 'scroller:2'])
  })
})

describe('splitShelfRows', () => {
  it('renumbers a mixed list into one gap-free sequence and tags shelfOrderVersion 2', () => {
    const rows = mergeShelfRows([scroller('1', 1), scroller('2', 3)], [external('owned-elsewhere', 2)], 2)
    const result = splitShelfRows(rows)

    expect(result.shelfOrderVersion).toBe(2)
    expect(result.scrollers.map((s) => [s.id, s.order])).toEqual([
      ['1', 1],
      ['2', 3],
    ])
    expect(result.externalShelves.map((s) => [s.shelf, s.order])).toEqual([['owned-elsewhere', 2]])
  })

  it('migrates a legacy external-first arrangement into the shared sequence', () => {
    const legacyRows = mergeShelfRows([scroller('1', 1), scroller('2', 2)], [external('owned-elsewhere', 1)], undefined)
    const result = splitShelfRows(legacyRows)

    expect(result.shelfOrderVersion).toBe(2)
    expect(result.externalShelves[0]?.order).toBe(1)
    expect(result.scrollers.map((s) => s.order)).toEqual([2, 3])
  })

  it('preserves a reordering the user dragged across kinds', () => {
    const legacyRows = mergeShelfRows([scroller('1', 1), scroller('2', 2)], [external('owned-elsewhere', 1)], undefined)
    // legacyRows is [external, scroller 1, scroller 2]; drag scroller 1 ahead of the external row.
    const reordered = [legacyRows[1]!, legacyRows[0]!, legacyRows[2]!]
    const result = splitShelfRows(reordered)

    expect(result.scrollers.map((s) => [s.id, s.order])).toEqual([
      ['1', 1],
      ['2', 3],
    ])
    expect(result.externalShelves[0]?.order).toBe(2)
  })
})

describe('isScrollerRow / isExternalRow', () => {
  it('narrow a mixed row to its own kind', () => {
    const rows = mergeShelfRows([scroller('1', 1)], [external('owned-elsewhere', 1)], 2)
    expect(rows.filter(isScrollerRow)).toHaveLength(1)
    expect(rows.filter(isExternalRow)).toHaveLength(1)
  })
})
