import { describe, expect, it } from 'vitest'
import { deriveSectionProgress, getSectionFractions } from '../reactor-section-progress'

// Fixture sizes chosen so every derived number has an exact, hand-checkable value (mirrors
// `public/assets/foliate/progress.js`'s own `SectionProgress` math byte-for-byte).
const SECTIONS = [{ size: 1000 }, { size: 2000 }, { size: 500 }]

describe('getSectionFractions', () => {
  it('returns the cumulative fraction at the start of each section plus a trailing 1', () => {
    expect(getSectionFractions(SECTIONS)).toEqual([0, 1000 / 3500, 3000 / 3500, 1])
  })

  it('returns an all-zero array when no section has a usable size', () => {
    expect(getSectionFractions([{ size: 0 }, { linear: 'no', size: 500 }])).toEqual([0, 0])
  })

  it('treats a non-linear section as sizeless even when it reports a size', () => {
    expect(getSectionFractions([{ size: 1000 }, { size: 1000, linear: 'no' }])).toEqual([0, 1, 1])
  })
})

describe('deriveSectionProgress', () => {
  it('derives section/location/time/kobo-percent from a mid-book fraction', () => {
    const result = deriveSectionProgress(SECTIONS, 0.5)

    expect(result).not.toBeNull()
    expect(result!.section).toEqual({ current: 1, total: 3 })
    expect(result!.location).toEqual({ current: 1, next: 1, total: 3 })
    expect(result!.time.section).toBeCloseTo(0.78125, 5)
    expect(result!.time.total).toBeCloseTo(1.09375, 5)
    expect(result!.contentSourceProgressPercent).toBeCloseTo(37.5, 5)
  })

  it('clamps to the first section at fraction 0', () => {
    const result = deriveSectionProgress(SECTIONS, 0)
    expect(result!.section).toEqual({ current: 0, total: 3 })
    // `Number.EPSILON` nudges the lookup fraction up, matching foliate's own `getSection` - the
    // in-section fraction lands at a vanishingly small positive value rather than exactly 0.
    expect(result!.contentSourceProgressPercent).toBeCloseTo(0, 9)
  })

  it('clamps to the last section at fraction 1', () => {
    const result = deriveSectionProgress(SECTIONS, 1)
    expect(result!.section).toEqual({ current: 2, total: 3 })
    expect(result!.contentSourceProgressPercent).toBe(100)
  })

  it('skips a zero-size (non-linear) section when resolving the index', () => {
    const sections = [{ size: 1000 }, { size: 0 }, { size: 1000 }]
    const result = deriveSectionProgress(sections, 0.5)
    // Fraction 0.5 falls exactly on the boundary; the zero-size middle section must never be
    // reported as the current section.
    expect(result!.section.current).not.toBe(1)
  })

  it('returns null when no section carries size data', () => {
    expect(deriveSectionProgress([{ size: 0 }, { size: 0 }], 0.5)).toBeNull()
    expect(deriveSectionProgress([], 0.5)).toBeNull()
  })

  it('treats a non-finite fraction as 0 rather than throwing', () => {
    const result = deriveSectionProgress(SECTIONS, Number.NaN)
    expect(result!.section).toEqual({ current: 0, total: 3 })
  })
})
