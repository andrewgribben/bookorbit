import { describe, expect, it } from 'vitest'
import { READING_SERVICE_FEATURES } from '@bookorbit/types'
import en from '@/locales/en.json'

/**
 * Regression test for a raw-key bug an owner screenshot caught in production: two features
 * (trending_shelf, recommendations_shelf) were added to READING_SERVICE_FEATURES without ever
 * getting en.json entries, so the settings page rendered the untranslated i18n key instead of a
 * label. Every feature id must have both a label and a hint, or ReadingServiceFeatureList and
 * ReadingServiceLibraries render raw `settings.readingServices.features.<id>.label` strings.
 */
describe('reading-service feature locale completeness', () => {
  const features = (en as any).settings.readingServices.features

  it('has an entry for every feature in READING_SERVICE_FEATURES', () => {
    for (const feature of READING_SERVICE_FEATURES) {
      expect(features, `missing en.json entry for feature "${feature}"`).toHaveProperty(feature)
    }
  })

  it('every feature entry has a non-empty label and hint', () => {
    for (const feature of READING_SERVICE_FEATURES) {
      const entry = features[feature]
      expect(entry, `missing en.json entry for feature "${feature}"`).toBeDefined()
      expect(typeof entry.label, `feature "${feature}" has no label`).toBe('string')
      expect(entry.label.length, `feature "${feature}" has an empty label`).toBeGreaterThan(0)
      expect(typeof entry.hint, `feature "${feature}" has no hint`).toBe('string')
      expect(entry.hint.length, `feature "${feature}" has an empty hint`).toBeGreaterThan(0)
    }
  })

  it('has no stray feature entries that are not in READING_SERVICE_FEATURES', () => {
    const known = new Set<string>(READING_SERVICE_FEATURES)
    for (const key of Object.keys(features)) {
      expect(known.has(key), `en.json has a feature entry "${key}" not in READING_SERVICE_FEATURES`).toBe(true)
    }
  })

  it('does not keep an "unavailable" copy key for a platform-unsupported feature (owner rule: hide, never grey with stock copy)', () => {
    for (const feature of READING_SERVICE_FEATURES) {
      if (feature === 'publish_sessions') continue // the one legitimate dependency-gated row; uses dependencyHint instead
      expect(features[feature], `feature "${feature}" still has an 'unavailable' key`).not.toHaveProperty('unavailable')
    }
  })
})
