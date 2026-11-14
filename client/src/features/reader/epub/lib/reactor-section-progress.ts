// Reactor's v1 `relocate` event drops the `section`/`time` fields foliate itself computes
// internally (see `src/core/content-core.ts`'s relocate listener, which only forwards `cfi`,
// `fraction`, `chapterTitle`, `location`, `reason`, `restoring`). `location` survives as an opaque
// passthrough of foliate's own object, but chapter/section index, remaining reading time and the
// Kobo "content source" percentage do not.
//
// `WebHost.core.getOpenBook()` still exposes the real foliate `FoliateBook`, whose `sections`
// carry the same `size`/`linear` fields foliate's own `src/vendor/foliate/progress.js`
// (`SectionProgress`) uses to produce those fields from a single `fraction` value. This module
// ports that same math so the web client can derive them without any Reactor protocol change
// (W1 plan docs/plans/W1.md R-G2: "stays web-side computation from cfi/fraction alone").
//
// Constants match foliate's own call site exactly: `new SectionProgress(book.sections, 1500, 1600)`
// in `public/assets/foliate/view.js`.
const SIZE_PER_LOCATION = 1500
const SIZE_PER_TIME_UNIT = 1600

export interface ReactorSectionLike {
  /** Byte size of the section's content document; 0/undefined sections (e.g. a non-linear
   * errata page) do not count towards reading-time or location totals. */
  size?: number
  linear?: string
  /** The spine item's id/href - foliate's own `koboLocationSource` value (`book.sections[index]?.id`). */
  id?: string
}

export interface SectionProgressResult {
  section: { current: number; total: number }
  location: { current: number; next: number; total: number }
  time: { section: number; total: number }
  /** Percent of the *current section* read so far - matches foliate's `toPercent(fraction)` call
   * in `#onRelocate`, where `fraction` is already section-relative, not the whole book. */
  contentSourceProgressPercent: number | null
}

function sectionSizes(sections: ReactorSectionLike[]): number[] {
  return sections.map((s) => (s.linear !== 'no' && typeof s.size === 'number' && s.size > 0 ? s.size : 0))
}

/** Cumulative fraction at the start of each section, plus a trailing `1` for the book's end -
 * mirrors `SectionProgress#getSectionFractions` exactly. Returns an all-zero array (rather than
 * throwing) when every section is sizeless, since a book with no size data cannot place sections
 * on a fraction axis at all. */
export function getSectionFractions(sections: ReactorSectionLike[]): number[] {
  const sizes = sectionSizes(sections)
  const sizeTotal = sizes.reduce((a, b) => a + b, 0)
  if (sizeTotal <= 0) return sizes.map(() => 0)
  const results = [0]
  let sum = 0
  for (const size of sizes) results.push((sum += size) / sizeTotal)
  return results
}

function toPercent(fraction: number): number | null {
  return Number.isFinite(fraction) ? Math.max(0, Math.min(100, fraction * 100)) : null
}

/**
 * Ports `SectionProgress#getSection` (inverse lookup: whole-book fraction -> section index and
 * fraction-within-section) followed by `SectionProgress#getProgress` (index + in-section fraction
 * -> section/location/time). Returns `null` when `sections` carries no usable size data (e.g. the
 * book has not finished opening yet, or a format with no size metadata) - this is the one case
 * nothing can be derived, since every field here needs at least relative section sizes.
 */
export function deriveSectionProgress(sections: ReactorSectionLike[], fraction: number): SectionProgressResult | null {
  const sizes = sectionSizes(sections)
  if (!sizes.length) return null
  const sizeTotal = sizes.reduce((a, b) => a + b, 0)
  if (sizeTotal <= 0) return null

  const sectionFractions = getSectionFractions(sections)
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))

  let index: number
  let fractionInSection: number
  if (clamped >= 1) {
    index = sizes.length - 1
    fractionInSection = 1
  } else {
    const target = clamped + Number.EPSILON
    let candidate = sectionFractions.findIndex((x) => x > target) - 1
    if (candidate < 0) {
      index = 0
      fractionInSection = 0
    } else {
      while (candidate < sizes.length - 1 && !sizes[candidate]) candidate++
      index = candidate
      fractionInSection = (target - (sectionFractions[index] ?? 0)) / ((sizes[index] ?? 1) / sizeTotal)
    }
  }

  const sizeInSection = sizes[index] ?? 0
  const sizeBefore = sizes.slice(0, index).reduce((a, b) => a + b, 0)
  const size = sizeBefore + fractionInSection * sizeInSection
  const remainingTotal = sizeTotal - size
  const remainingSection = (1 - fractionInSection) * sizeInSection

  return {
    section: { current: index, total: sizes.length },
    location: {
      current: Math.floor(size / SIZE_PER_LOCATION),
      next: Math.floor(size / SIZE_PER_LOCATION),
      total: Math.ceil(sizeTotal / SIZE_PER_LOCATION),
    },
    time: {
      section: remainingSection / SIZE_PER_TIME_UNIT,
      total: remainingTotal / SIZE_PER_TIME_UNIT,
    },
    contentSourceProgressPercent: toPercent(fractionInSection),
  }
}
