<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Lock, LockOpen, Plus, Trash2 } from '@lucide/vue'
import type { AudiobookChapter, BookMetadataLockField } from '@bookorbit/types'
import {
  chaptersFromAudioTracks,
  formatChapterTime,
  insertChapterAfter,
  parseChapterTime,
  shiftChapterTimes,
  validateChapters,
  type ChapterValidationIssue,
} from '../../../lib/audiobook-chapters'

const props = defineProps<{
  modelValue: AudiobookChapter[]
  durationSeconds: number | null
  locked: boolean
  disabled?: boolean
  isUpdating?: (field: BookMetadataLockField) => boolean
  audioTracks?: readonly { filename: string; durationSeconds: number | null; format: string | null }[]
  isAudioFormat?: (format: string) => boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [AudiobookChapter[]]
  toggleLock: []
}>()

const { t } = useI18n()

const shiftSecondsInput = ref('0')
const timeDrafts = ref<string[]>([])

const durationMs = computed(() => (props.durationSeconds != null && props.durationSeconds > 0 ? props.durationSeconds * 1000 : null))
const issues = computed(() => validateChapters(props.modelValue, durationMs.value))
const issuesByIndex = computed(() => {
  const map = new Map<number, ChapterValidationIssue[]>()
  for (const issue of issues.value) {
    const list = map.get(issue.index) ?? []
    list.push(issue)
    map.set(issue.index, list)
  }
  return map
})
const hasIssues = computed(() => issues.value.length > 0)
const canSetFromTracks = computed(() => {
  if (!props.audioTracks?.length || !props.isAudioFormat) return false
  return chaptersFromAudioTracks(props.audioTracks, props.isAudioFormat) != null
})
const lockLoading = computed(() => props.isUpdating?.('chapters') ?? false)
const editorDisabled = computed(() => props.disabled || props.locked)

watch(
  () => props.modelValue,
  (chapters) => {
    timeDrafts.value = chapters.map((chapter) => formatChapterTime(chapter.startMs))
  },
  { immediate: true, deep: true },
)

function issueMessage(code: ChapterValidationIssue['code']): string {
  switch (code) {
    case 'empty_title':
      return t('book.detail.editMetadata.chaptersEmptyTitle')
    case 'negative_start':
      return t('book.detail.editMetadata.chaptersNegativeStart')
    case 'first_must_be_zero':
      return t('book.detail.editMetadata.chaptersFirstMustBeZero')
    case 'not_ascending':
      return t('book.detail.editMetadata.chaptersNotAscending')
    case 'beyond_duration':
      return t('book.detail.editMetadata.chaptersBeyondDuration')
  }
}

function updateChapter(index: number, patch: Partial<AudiobookChapter>) {
  if (editorDisabled.value) return
  emit(
    'update:modelValue',
    props.modelValue.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)),
  )
}

function commitTime(index: number) {
  if (editorDisabled.value) return
  const parsed = parseChapterTime(timeDrafts.value[index] ?? '')
  if (parsed == null) {
    timeDrafts.value[index] = formatChapterTime(props.modelValue[index]?.startMs ?? 0)
    return
  }
  updateChapter(index, { startMs: parsed })
}

function chapterTitle(number: number) {
  return t('book.detail.editMetadata.chaptersDefaultTitle', { number })
}

function addChapter() {
  if (editorDisabled.value) return
  if (props.modelValue.length === 0) {
    emit('update:modelValue', [{ title: chapterTitle(1), startMs: 0 }])
    return
  }
  emit(
    'update:modelValue',
    insertChapterAfter(props.modelValue, props.modelValue.length - 1, durationMs.value, chapterTitle(props.modelValue.length + 1)),
  )
}

function addChapterAfter(index: number) {
  if (editorDisabled.value) return
  emit('update:modelValue', insertChapterAfter(props.modelValue, index, durationMs.value, chapterTitle(index + 2)))
}

function removeChapter(index: number) {
  if (editorDisabled.value) return
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

function clearChapters() {
  if (editorDisabled.value) return
  emit('update:modelValue', [])
}

function applyShift() {
  if (editorDisabled.value) return
  const seconds = Number.parseFloat(shiftSecondsInput.value)
  if (!Number.isFinite(seconds) || seconds === 0) return
  emit('update:modelValue', shiftChapterTimes(props.modelValue, Math.round(seconds * 1000)))
}

function setFromTracks() {
  if (editorDisabled.value || !props.audioTracks || !props.isAudioFormat) return
  const next = chaptersFromAudioTracks(props.audioTracks, props.isAudioFormat)
  if (next) emit('update:modelValue', next)
}

function nudgeTime(index: number, deltaSeconds: number) {
  if (editorDisabled.value) return
  const chapter = props.modelValue[index]
  if (!chapter) return
  const nextStart = index === 0 ? 0 : Math.max(0, chapter.startMs + deltaSeconds * 1000)
  updateChapter(index, { startMs: nextStart })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <h4 class="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
          {{ t('book.detail.editMetadata.chaptersLabel') }}
        </h4>
        <span class="text-[10px] font-semibold text-muted-foreground">
          {{ t('book.detail.editMetadata.chapterCount', { count: modelValue.length }) }}
        </span>
      </div>
      <button
        type="button"
        class="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed sm:size-6"
        :class="
          locked
            ? 'border-primary/30 bg-primary/15 text-primary hover:bg-primary/25'
            : 'border-transparent text-muted-foreground hover:border-input hover:bg-muted hover:text-foreground'
        "
        :aria-label="
          locked
            ? t('book.detail.editMetadata.unlockField', { field: t('book.detail.editMetadata.chaptersLabel') })
            : t('book.detail.editMetadata.lockField', { field: t('book.detail.editMetadata.chaptersLabel') })
        "
        :disabled="lockLoading || disabled"
        @click="emit('toggleLock')"
      >
        <Loader2 v-if="lockLoading" class="size-3.5 animate-spin" aria-hidden="true" />
        <Lock v-else-if="locked" class="size-3.5" aria-hidden="true" />
        <LockOpen v-else class="size-3.5" aria-hidden="true" />
      </button>
    </div>

    <p class="text-xs text-muted-foreground">{{ t('book.detail.editMetadata.chaptersHint') }}</p>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="editorDisabled"
        @click="addChapter"
      >
        {{ t('book.detail.editMetadata.chaptersAdd') }}
      </button>
      <button
        type="button"
        class="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="editorDisabled || modelValue.length === 0"
        @click="clearChapters"
      >
        {{ t('book.detail.editMetadata.chaptersRemoveAll') }}
      </button>
      <button
        v-if="canSetFromTracks"
        type="button"
        class="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="editorDisabled"
        @click="setFromTracks"
      >
        {{ t('book.detail.editMetadata.chaptersFromTracks') }}
      </button>
      <div class="flex items-center gap-1.5">
        <input
          v-model="shiftSecondsInput"
          type="number"
          step="0.1"
          class="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="editorDisabled || modelValue.length === 0"
          :aria-label="t('book.detail.editMetadata.chaptersShiftAmount')"
        />
        <button
          type="button"
          class="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="editorDisabled || modelValue.length === 0"
          @click="applyShift"
        >
          {{ t('book.detail.editMetadata.chaptersShift') }}
        </button>
      </div>
    </div>

    <div v-if="modelValue.length === 0" class="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {{ t('book.detail.editMetadata.chaptersEmpty') }}
    </div>

    <div v-else class="overflow-hidden rounded-lg border border-border">
      <div
        class="grid grid-cols-[auto_minmax(7rem,8.5rem)_minmax(0,1fr)_auto] gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase"
      >
        <span>#</span>
        <span>{{ t('book.detail.editMetadata.chaptersStart') }}</span>
        <span>{{ t('book.detail.editMetadata.chaptersTitle') }}</span>
        <span class="sr-only">{{ t('book.detail.editMetadata.chaptersActions') }}</span>
      </div>
      <ul class="divide-y divide-border">
        <li v-for="(chapter, index) in modelValue" :key="`chapter-${index}`" class="space-y-1 px-2.5 py-2">
          <div class="grid grid-cols-[auto_minmax(7rem,8.5rem)_minmax(0,1fr)_auto] items-start gap-2">
            <span class="pt-2 text-xs tabular-nums text-muted-foreground">{{ index + 1 }}</span>
            <div class="space-y-1">
              <input
                v-model="timeDrafts[index]"
                class="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="editorDisabled"
                :aria-label="t('book.detail.editMetadata.chaptersStartFor', { number: index + 1 })"
                @blur="commitTime(index)"
                @keydown.enter.prevent="commitTime(index)"
              />
              <div class="flex gap-1">
                <button
                  type="button"
                  class="h-6 rounded border border-input px-1.5 text-[10px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="editorDisabled || index === 0"
                  @click="nudgeTime(index, -1)"
                >
                  -1s
                </button>
                <button
                  type="button"
                  class="h-6 rounded border border-input px-1.5 text-[10px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="editorDisabled || index === 0"
                  @click="nudgeTime(index, 1)"
                >
                  +1s
                </button>
              </div>
            </div>
            <input
              :value="chapter.title"
              class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="editorDisabled"
              :aria-label="t('book.detail.editMetadata.chaptersTitleFor', { number: index + 1 })"
              @input="updateChapter(index, { title: ($event.target as HTMLInputElement).value })"
            />
            <div class="flex items-center gap-1 pt-1">
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="editorDisabled"
                :aria-label="t('book.detail.editMetadata.chaptersAddAfter', { number: index + 1 })"
                @click="addChapterAfter(index)"
              >
                <Plus class="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="editorDisabled"
                :aria-label="t('book.detail.editMetadata.chaptersRemove', { number: index + 1 })"
                @click="removeChapter(index)"
              >
                <Trash2 class="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-for="issue in issuesByIndex.get(index) ?? []" :key="`${index}-${issue.code}`" class="pl-6 text-xs text-destructive">
            {{ issueMessage(issue.code) }}
          </p>
        </li>
      </ul>
    </div>

    <p v-if="hasIssues" class="text-xs text-destructive">{{ t('book.detail.editMetadata.chaptersFixBeforeSave') }}</p>
  </div>
</template>
