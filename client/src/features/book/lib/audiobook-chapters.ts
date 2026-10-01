import type { AudiobookChapter } from '@bookorbit/types'

export type EditableAudiobookChapter = AudiobookChapter

export type ChapterValidationCode = 'empty_title' | 'negative_start' | 'first_must_be_zero' | 'not_ascending' | 'beyond_duration'

export type ChapterValidationIssue = {
  index: number
  code: ChapterValidationCode
}

/** Normalize stored/null chapters into an editable list. */
export function normalizeEditableChapters(chapters: readonly AudiobookChapter[] | null | undefined): EditableAudiobookChapter[] {
  if (!chapters?.length) return []
  return chapters.map((chapter) => ({
    title: chapter.title ?? '',
    startMs: Number.isFinite(chapter.startMs) ? Math.max(0, Math.round(chapter.startMs)) : 0,
  }))
}

/** Payload form: empty list becomes null so the DB matches scanner “no chapters”. */
export function chaptersForPayload(chapters: readonly EditableAudiobookChapter[]): AudiobookChapter[] | null {
  const normalized = normalizeEditableChapters(chapters).map((chapter) => ({
    title: chapter.title.trim(),
    startMs: chapter.startMs,
  }))
  return normalized.length > 0 ? normalized : null
}

/**
 * Format milliseconds as `H:MM:SS` or `H:MM:SS.mmm` when there are sub-second remainders.
 * Hours are unpadded so short books stay compact.
 */
export function formatChapterTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  const base = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return millis > 0 ? `${base}.${String(millis).padStart(3, '0')}` : base
}

/**
 * Parse common chapter time inputs into milliseconds.
 * Accepts plain seconds (`90`, `90.5`), `MM:SS`, and `H:MM:SS` with optional fractional seconds.
 */
export function parseChapterTime(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const seconds = Number.parseFloat(raw)
    return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null
  }

  const parts = raw.split(':')
  if (parts.length === 2) {
    const minutes = Number.parseInt(parts[0]!, 10)
    const seconds = Number.parseFloat(parts[1]!)
    if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return null
    return minutes * 60_000 + Math.round(seconds * 1000)
  }

  if (parts.length === 3) {
    const hours = Number.parseInt(parts[0]!, 10)
    const minutes = Number.parseInt(parts[1]!, 10)
    const seconds = Number.parseFloat(parts[2]!)
    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      minutes >= 60 ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds >= 60
    ) {
      return null
    }
    return hours * 3_600_000 + minutes * 60_000 + Math.round(seconds * 1000)
  }

  return null
}

export function validateChapters(chapters: readonly EditableAudiobookChapter[], durationMs: number | null): ChapterValidationIssue[] {
  const issues: ChapterValidationIssue[] = []
  let previousStart = -1

  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index]!
    if (!chapter.title.trim()) {
      issues.push({ index, code: 'empty_title' })
    }
    if (!Number.isFinite(chapter.startMs) || chapter.startMs < 0) {
      issues.push({ index, code: 'negative_start' })
      continue
    }
    if (index === 0 && chapter.startMs !== 0) {
      issues.push({ index, code: 'first_must_be_zero' })
    }
    if (index > 0 && chapter.startMs <= previousStart) {
      issues.push({ index, code: 'not_ascending' })
    }
    if (durationMs != null && durationMs > 0 && chapter.startMs > durationMs) {
      issues.push({ index, code: 'beyond_duration' })
    }
    previousStart = chapter.startMs
  }

  return issues
}

export function shiftChapterTimes(chapters: readonly EditableAudiobookChapter[], deltaMs: number): EditableAudiobookChapter[] {
  if (deltaMs === 0 || chapters.length === 0) return chapters.map((chapter) => ({ ...chapter }))
  return chapters.map((chapter, index) => {
    if (index === 0) return { ...chapter, startMs: 0 }
    return { ...chapter, startMs: Math.max(0, chapter.startMs + deltaMs) }
  })
}

export function chaptersFromAudioTracks(
  files: readonly { filename: string; durationSeconds: number | null; format: string | null }[],
  isAudioFormat: (format: string) => boolean,
): EditableAudiobookChapter[] | null {
  const tracks = files.filter((file) => file.format != null && isAudioFormat(file.format))
  if (tracks.length < 2) return null
  if (tracks.some((file) => file.durationSeconds == null || file.durationSeconds <= 0)) return null

  const chapters: EditableAudiobookChapter[] = []
  let offsetMs = 0
  for (const track of tracks) {
    const title = track.filename.replace(/\.[^.]+$/, '') || track.filename
    chapters.push({ title, startMs: offsetMs })
    offsetMs += Math.round((track.durationSeconds ?? 0) * 1000)
  }
  return chapters
}

export function insertChapterAfter(
  chapters: readonly EditableAudiobookChapter[],
  index: number,
  durationMs: number | null,
  title: string,
): EditableAudiobookChapter[] {
  const current = chapters[index]
  const next = chapters[index + 1]
  const startMs =
    current == null
      ? 0
      : next != null
        ? Math.round((current.startMs + next.startMs) / 2)
        : durationMs != null && durationMs > current.startMs
          ? Math.round((current.startMs + durationMs) / 2)
          : current.startMs + 60_000

  const inserted: EditableAudiobookChapter = {
    title,
    startMs: chapters.length === 0 ? 0 : startMs,
  }
  const nextList = [...chapters]
  nextList.splice(index + 1, 0, inserted)
  if (nextList[0] && nextList[0].startMs !== 0) nextList[0] = { ...nextList[0], startMs: 0 }
  return nextList
}
