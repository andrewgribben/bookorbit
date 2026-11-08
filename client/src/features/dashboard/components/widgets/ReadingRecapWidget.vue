<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpenCheck } from '@lucide/vue'

import { formatHours } from '@/features/reading-history/lib/history-format'
import { useReadingRecapWidget } from '../../composables/useReadingRecapWidget'

const { data, loading } = useReadingRecapWidget()
const { t } = useI18n()

// The widget hides entirely (no card, no empty state) when Readwise isn't connected or the
// `recap_widget` feature is off: the endpoint returns null rather than a zeroed shape, and the
// card shell this component renders into is what the orchestrator review called out to keep
// honest rather than showing an empty "reading recap" tile for a provider nobody connected.
const hasRecap = computed(() => data.value !== null)

const maxMonthSeconds = computed(() => {
  if (!data.value) return 1
  return Math.max(1, ...data.value.byMonth.map((m) => m.seconds))
})

const currentMonth = computed(() => new Date().getUTCMonth() + 1)

const hasGoal = computed(() => (data.value?.goal ?? null) !== null && (data.value?.goal ?? 0) > 0)

const goalPercent = computed(() => {
  if (!data.value || !hasGoal.value) return 0
  return Math.min(100, Math.round((data.value.booksFinished / data.value.goal!) * 100))
})

function monthLabel(month: number): string {
  return t(`dashboard.widgets.readingRecap.monthShort.${month}`)
}
</script>

<template>
  <div v-if="loading || hasRecap" class="flex h-full flex-col p-3">
    <div class="mb-2 flex items-center gap-2 self-start">
      <BookOpenCheck :size="16" class="text-primary" />
      <span class="text-[15px] font-semibold text-foreground">{{ t('dashboard.widgets.readingRecap.title', { year: data?.year ?? '' }) }}</span>
    </div>

    <div v-if="loading" class="flex flex-1 flex-col gap-2">
      <div class="h-10 animate-pulse rounded-xs bg-muted" />
      <div class="flex-1 animate-pulse rounded-xs bg-muted" />
    </div>

    <div v-else-if="data" class="flex flex-1 flex-col">
      <div class="grid grid-cols-4 gap-2 text-center">
        <div>
          <p class="text-lg leading-none font-semibold tabular-nums text-foreground">{{ data.booksFinished }}</p>
          <p class="mt-1 text-[10px] leading-tight text-muted-foreground">{{ t('dashboard.widgets.readingRecap.booksFinished') }}</p>
        </div>
        <div>
          <p class="text-lg leading-none font-semibold tabular-nums text-foreground">{{ formatHours(data.totalSeconds) }}h</p>
          <p class="mt-1 text-[10px] leading-tight text-muted-foreground">{{ t('dashboard.widgets.readingRecap.readingTime') }}</p>
        </div>
        <div>
          <p class="text-lg leading-none font-semibold tabular-nums text-foreground">{{ data.sessions }}</p>
          <p class="mt-1 text-[10px] leading-tight text-muted-foreground">{{ t('dashboard.widgets.readingRecap.sessions') }}</p>
        </div>
        <div>
          <p class="text-lg leading-none font-semibold tabular-nums text-foreground">{{ data.readingDays }}</p>
          <p class="mt-1 text-[10px] leading-tight text-muted-foreground">{{ t('dashboard.widgets.readingRecap.readingDays') }}</p>
        </div>
      </div>

      <div v-if="hasGoal" class="mt-3">
        <div class="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{{ t('dashboard.widgets.readingRecap.goal', { goal: data.goal }) }}</span>
          <span class="font-semibold tabular-nums text-foreground">{{ data.booksFinished }} / {{ data.goal }} &middot; {{ goalPercent }}%</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary transition-all duration-300" :style="{ width: `${goalPercent}%` }" />
        </div>
      </div>
      <p v-else class="mt-3 text-[11px] text-muted-foreground">{{ t('dashboard.widgets.readingRecap.noGoal') }}</p>

      <div class="mt-3 flex flex-1 items-end gap-[3px]">
        <div v-for="month in data.byMonth" :key="month.month" class="flex flex-1 flex-col-reverse items-center gap-1">
          <div
            class="w-full rounded-t-sm transition-all duration-300"
            :class="month.month === currentMonth ? 'bg-primary' : month.seconds > 0 ? 'bg-primary/40' : 'bg-muted/50'"
            :style="{ height: `${Math.max(3, (month.seconds / maxMonthSeconds) * 100)}%`, minHeight: '3px' }"
          />
          <span class="text-[8.5px] text-muted-foreground">{{ monthLabel(month.month) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
