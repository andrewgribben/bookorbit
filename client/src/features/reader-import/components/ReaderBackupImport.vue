<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Upload } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { seriesFollowStatusLabelKey } from '@/features/series/lib/series-follow-status'
import { useReaderBackupImport } from '../composables/useReaderBackupImport'

const { t } = useI18n()
const { file, result, busy, error, selectFile, preview, apply } = useReaderBackupImport()

const toSet = computed(() => result.value?.series.filter((item) => item.action === 'set') ?? [])
const kept = computed(() => result.value?.series.filter((item) => item.action === 'kept') ?? [])
const canApply = computed(() => !!result.value && !result.value.applied && (toSet.value.length > 0 || result.value.booksToMarkRead > 0))

function handleFileChange(event: Event) {
  selectFile((event.target as HTMLInputElement).files?.[0] ?? null)
}

function handlePreview() {
  void preview()
}

async function handleApply() {
  if (await apply()) toast.success(t('settings.reader.komga.import.applied'))
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="file"
        accept=".tachibk,.proto.gz,.gz"
        class="input-field w-full text-sm sm:flex-1"
        data-testid="reader-import-file"
        @change="handleFileChange"
      />
      <Button variant="outline" size="sm" :disabled="!file || busy" data-testid="reader-import-preview" @click="handlePreview">
        <Upload class="size-4 mr-1" />
        {{ t('settings.reader.komga.import.preview') }}
      </Button>
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <div v-if="result" class="flex flex-col gap-4" data-testid="reader-import-result">
      <p class="text-sm text-foreground">
        {{
          t('settings.reader.komga.import.summary', {
            series: result.libraryEntries,
            matched: result.matchedChapters,
            chapters: result.chapters,
            read: result.booksToMarkRead,
          })
        }}
      </p>

      <div v-if="toSet.length > 0">
        <p class="settings-label mb-1">{{ t('settings.reader.komga.import.willSet', { count: toSet.length }) }}</p>
        <ul class="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          <li v-for="item in toSet" :key="item.seriesId" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span class="min-w-0 truncate">{{ item.seriesName }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ t(seriesFollowStatusLabelKey(item.status)) }}</span>
          </li>
        </ul>
      </div>

      <p v-if="kept.length > 0" class="text-sm text-muted-foreground">
        {{ t('settings.reader.komga.import.kept', { count: kept.length }) }}
      </p>

      <div v-if="result.numberMatches.length > 0">
        <p class="settings-label mb-1">{{ t('settings.reader.komga.import.numberMatches', { count: result.numberMatches.length }) }}</p>
        <ul class="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          <li v-for="match in result.numberMatches" :key="`${match.appTitle}-${match.chapterName}`" class="px-3 py-2 text-sm">
            <span class="block truncate">{{ match.chapterName }}</span>
            <span class="block truncate text-xs text-muted-foreground">{{ match.seriesName }} #{{ match.seriesIndex }}</span>
          </li>
        </ul>
      </div>

      <div v-if="result.unmatched.length > 0">
        <p class="settings-label mb-1">{{ t('settings.reader.komga.import.unmatched', { count: result.unmatched.length }) }}</p>
        <ul class="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          <li v-for="item in result.unmatched" :key="item.appTitle" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span class="min-w-0 truncate">{{ item.appTitle }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">
              {{ t('settings.reader.komga.import.missingChapters', { missing: item.unmatchedChapters, total: item.chapters }) }}
            </span>
          </li>
        </ul>
      </div>

      <p v-if="result.applied" class="text-sm text-primary">{{ t('settings.reader.komga.import.applied') }}</p>
      <Button v-else-if="canApply" class="self-start" :disabled="busy" data-testid="reader-import-apply" @click="handleApply">
        {{ t('settings.reader.komga.import.apply') }}
      </Button>
      <p v-else class="text-sm text-muted-foreground">{{ t('settings.reader.komga.import.nothingToDo') }}</p>
    </div>
  </div>
</template>
