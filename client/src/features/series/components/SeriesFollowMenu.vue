<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, CheckCheck, ChevronDown, ListChecks, ListOrdered } from '@lucide/vue'

import { SERIES_FOLLOW_STATUSES, type SeriesFollowStatus } from '@bookorbit/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSeriesFollowActions } from '../composables/useSeriesFollowActions'
import { seriesFollowStatusLabelKey } from '../lib/series-follow-status'

const props = defineProps<{
  seriesId: number
  /** Current status; undefined when the caller does not know it, so no option is ticked. */
  status?: SeriesFollowStatus | null
  /** Offers "Mark read up to here" for this book. */
  upToBookId?: number
  compact?: boolean
}>()

const emit = defineEmits<{ changed: [status: SeriesFollowStatus | null | undefined] }>()

const { t } = useI18n()
const { pending, setStatus, markRead } = useSeriesFollowActions()
const confirmMarkAllOpen = ref(false)

const triggerLabel = computed(() => (props.status ? t(seriesFollowStatusLabelKey(props.status)) : t('series.follow.label')))

async function handleStatus(status: SeriesFollowStatus | null) {
  if (await setStatus(props.seriesId, status)) emit('changed', status)
}

function handleClearStatus() {
  void handleStatus(null)
}

async function handleMarkReadUpTo() {
  if (props.upToBookId !== undefined && (await markRead(props.seriesId, props.upToBookId))) emit('changed', props.status)
}

function handleMarkAllRead() {
  confirmMarkAllOpen.value = true
}

function handleCancelMarkAll() {
  confirmMarkAllOpen.value = false
}

async function handleConfirmMarkAll() {
  const done = await markRead(props.seriesId)
  confirmMarkAllOpen.value = false
  if (done) emit('changed', props.status)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :disabled="pending"
        :aria-label="t('series.follow.label')"
        :class="
          compact
            ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            : 'flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted'
        "
      >
        <ListOrdered :size="compact ? 14 : 15" />
        <template v-if="!compact">
          <span>{{ triggerLabel }}</span>
          <ChevronDown :size="14" class="text-muted-foreground" />
        </template>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem v-for="option in SERIES_FOLLOW_STATUSES" :key="option" @click="handleStatus(option)">
        {{ t(seriesFollowStatusLabelKey(option)) }}
        <Check v-if="status === option" class="ml-auto size-3 text-primary" />
      </DropdownMenuItem>
      <DropdownMenuItem v-if="status !== undefined" @click="handleClearStatus">
        {{ t('series.follow.none') }}
        <Check v-if="status === null" class="ml-auto size-3 text-primary" />
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-if="upToBookId !== undefined" @click="handleMarkReadUpTo">
        <ListChecks class="mr-2 size-4" />
        {{ t('series.follow.markReadUpTo') }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleMarkAllRead">
        <CheckCheck class="mr-2 size-4" />
        {{ t('series.follow.markAllRead') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <ConfirmDialog
    :open="confirmMarkAllOpen"
    :title="t('series.follow.markAllReadTitle')"
    :description="t('series.follow.markAllReadDescription')"
    :confirm-label="t('series.follow.markAllRead')"
    :busy="pending"
    :destructive="false"
    @confirm="handleConfirmMarkAll"
    @cancel="handleCancelMarkAll"
  />
</template>
