import { describe, expect, it } from 'vitest'
import type { EpubMediaOverlayPlaylist } from '@bookorbit/types'
import { chooseNarrationStart, mediaOverlayItemFragment, resolveMediaOverlayResume } from './media-overlay-resume'

function makePlaylist(): EpubMediaOverlayPlaylist {
  return {
    bookId: 1,
    fileId: 42,
    durationSeconds: 30,
    sections: [
      { index: 0, href: 'OPS/ch1.xhtml', label: 'One', smilHref: 'OPS/ch1.smil', startSeconds: 0, durationSeconds: 12 },
      { index: 1, href: 'OPS/ch2.xhtml', label: 'Two', smilHref: 'OPS/ch2.smil', startSeconds: 12, durationSeconds: 18 },
    ],
    resources: [],
    items: [
      {
        index: 0,
        sectionIndex: 0,
        smilHref: 'OPS/ch1.smil',
        textHref: 'OPS/ch1.xhtml',
        textFragment: 's1',
        audioHref: 'OPS/audio/ch1.mp3',
        audioMimeType: 'audio/mpeg',
        clipBeginSeconds: 0,
        clipEndSeconds: 4,
        durationSeconds: 4,
        label: 'One',
      },
      {
        index: 1,
        sectionIndex: 0,
        smilHref: 'OPS/ch1.smil',
        textHref: 'OPS/ch1.xhtml',
        textFragment: 's2',
        audioHref: 'OPS/audio/ch1.mp3',
        audioMimeType: 'audio/mpeg',
        clipBeginSeconds: 4,
        clipEndSeconds: 12,
        durationSeconds: 8,
        label: 'One',
      },
      {
        index: 2,
        sectionIndex: 1,
        smilHref: 'OPS/ch2.smil',
        textHref: 'OPS/ch2.xhtml',
        textFragment: 's1',
        audioHref: 'OPS/audio/ch2.mp3',
        audioMimeType: 'audio/mpeg',
        clipBeginSeconds: 0,
        clipEndSeconds: 18,
        durationSeconds: 18,
        label: 'Two',
      },
    ],
  }
}

describe('media-overlay resume', () => {
  it('builds full text fragments from playlist items', () => {
    expect(mediaOverlayItemFragment(makePlaylist().items[0]!)).toBe('OPS/ch1.xhtml#s1')
  })

  it('keeps an exact saved fragment and section without requiring playlist lookup', () => {
    expect(
      resolveMediaOverlayResume(makePlaylist(), {
        fragment: 'OPS/ch9.xhtml#s9',
        sectionIndex: 9,
        positionSeconds: 20,
      }),
    ).toEqual({ section: 9, fragment: 'OPS/ch9.xhtml#s9' })
  })

  it('fills a missing section from the saved fragment', () => {
    expect(
      resolveMediaOverlayResume(makePlaylist(), {
        fragment: 'OPS/ch2.xhtml#s1',
        sectionIndex: null,
        positionSeconds: null,
      }),
    ).toEqual({ section: 1, fragment: 'OPS/ch2.xhtml#s1' })
  })

  it('maps absolute narration seconds to the matching sentence', () => {
    expect(
      resolveMediaOverlayResume(makePlaylist(), {
        fragment: null,
        sectionIndex: null,
        positionSeconds: 6,
      }),
    ).toEqual({ section: 0, fragment: 'OPS/ch1.xhtml#s2' })

    expect(
      resolveMediaOverlayResume(makePlaylist(), {
        fragment: null,
        sectionIndex: null,
        positionSeconds: 15,
      }),
    ).toEqual({ section: 1, fragment: 'OPS/ch2.xhtml#s1' })
  })
})

describe('chooseNarrationStart', () => {
  const saved = { section: 0, fragment: 'OPS/ch1.xhtml#s1' }

  it('keeps the saved sentence when it is still on the page', () => {
    expect(chooseNarrationStart({ saved, sectionIndex: 0, savedOnPage: true })).toEqual({
      section: 0,
      fragment: 'OPS/ch1.xhtml#s1',
    })
  })

  it('keeps the saved sentence on the same chapter when the page could not be measured', () => {
    expect(chooseNarrationStart({ saved, sectionIndex: 0, savedOnPage: null })).toEqual({
      section: 0,
      fragment: 'OPS/ch1.xhtml#s1',
    })
  })

  it('starts at the chapter on screen when the saved sentence is an earlier chapter', () => {
    expect(chooseNarrationStart({ saved, sectionIndex: 32, savedOnPage: false })).toEqual({ section: 32, fragment: null })
  })

  it('starts at the page on screen when the saved sentence has scrolled away', () => {
    expect(chooseNarrationStart({ saved, sectionIndex: 0, savedOnPage: false })).toEqual({ section: 0, fragment: null })
  })

  it('starts at the page on screen when nothing has been narrated yet', () => {
    expect(chooseNarrationStart({ saved: null, sectionIndex: 32, savedOnPage: null })).toEqual({ section: 32, fragment: null })
  })
})
