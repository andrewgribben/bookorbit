import { describe, expect, it } from 'vitest'
import {
  chaptersForPayload,
  chaptersFromAudioTracks,
  formatChapterTime,
  insertChapterAfter,
  normalizeEditableChapters,
  parseChapterTime,
  shiftChapterTimes,
  validateChapters,
} from '../audiobook-chapters'

describe('formatChapterTime / parseChapterTime', () => {
  it('round-trips common clock values', () => {
    expect(formatChapterTime(0)).toBe('0:00:00')
    expect(formatChapterTime(65_000)).toBe('0:01:05')
    expect(formatChapterTime(3_661_500)).toBe('1:01:01.500')
    expect(parseChapterTime('0:00:00')).toBe(0)
    expect(parseChapterTime('1:05')).toBe(65_000)
    expect(parseChapterTime('1:01:01.5')).toBe(3_661_500)
    expect(parseChapterTime('90')).toBe(90_000)
    expect(parseChapterTime('90.5')).toBe(90_500)
  })

  it('rejects invalid clock values', () => {
    expect(parseChapterTime('')).toBeNull()
    expect(parseChapterTime('1:60')).toBeNull()
    expect(parseChapterTime('1:02:60')).toBeNull()
    expect(parseChapterTime('abc')).toBeNull()
  })
})

describe('validateChapters', () => {
  it('requires a zero start, ascending times, titles, and duration bounds', () => {
    expect(
      validateChapters(
        [
          { title: '', startMs: 1000 },
          { title: 'Two', startMs: 500 },
          { title: 'Three', startMs: 9_000_000 },
        ],
        3_600_000,
      ),
    ).toEqual([
      { index: 0, code: 'empty_title' },
      { index: 0, code: 'first_must_be_zero' },
      { index: 1, code: 'not_ascending' },
      { index: 2, code: 'beyond_duration' },
    ])
  })

  it('accepts a valid chapter list', () => {
    expect(
      validateChapters(
        [
          { title: 'Intro', startMs: 0 },
          { title: 'One', startMs: 60_000 },
        ],
        3_600_000,
      ),
    ).toEqual([])
  })
})

describe('chapter list helpers', () => {
  it('normalizes null chapters and payload emptiness', () => {
    expect(normalizeEditableChapters(null)).toEqual([])
    expect(chaptersForPayload([])).toBeNull()
    expect(chaptersForPayload([{ title: '  Intro  ', startMs: 0 }])).toEqual([{ title: 'Intro', startMs: 0 }])
  })

  it('shifts later chapters and keeps the first at zero', () => {
    expect(
      shiftChapterTimes(
        [
          { title: 'Intro', startMs: 0 },
          { title: 'One', startMs: 60_000 },
        ],
        -5_000,
      ),
    ).toEqual([
      { title: 'Intro', startMs: 0 },
      { title: 'One', startMs: 55_000 },
    ])
  })

  it('inserts a chapter midway and builds chapters from multi-file tracks', () => {
    expect(
      insertChapterAfter(
        [
          { title: 'One', startMs: 0 },
          { title: 'Three', startMs: 120_000 },
        ],
        0,
        180_000,
        'Chapter 2',
      ),
    ).toEqual([
      { title: 'One', startMs: 0 },
      { title: 'Chapter 2', startMs: 60_000 },
      { title: 'Three', startMs: 120_000 },
    ])

    expect(
      chaptersFromAudioTracks(
        [
          { filename: '01 - Opening.m4b', durationSeconds: 100, format: 'm4b' },
          { filename: '02 - Close.m4b', durationSeconds: 200, format: 'm4b' },
        ],
        (format) => format === 'm4b',
      ),
    ).toEqual([
      { title: '01 - Opening', startMs: 0 },
      { title: '02 - Close', startMs: 100_000 },
    ])
  })
})
