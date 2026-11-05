<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ListChecks, ListRestart } from '@lucide/vue'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useSeriesFollowActions } from '../composables/useSeriesFollowActions'

const props = defineProps<{ seriesId: number; bookId: number }>()

const { t } = useI18n()
const { markRead, markUnreadFrom } = useSeriesFollowActions()

function handleMarkReadUpTo() {
  void markRead(props.seriesId, props.bookId)
}

function handleMarkUnreadFrom() {
  void markUnreadFrom(props.seriesId, props.bookId)
}
</script>

<template>
  <DropdownMenuSeparator />
  <DropdownMenuItem data-testid="series-mark-read-up-to" @click="handleMarkReadUpTo">
    <ListChecks class="mr-2 size-4" />
    {{ t('series.follow.markReadUpTo') }}
  </DropdownMenuItem>
  <DropdownMenuItem data-testid="series-mark-unread-from" @click="handleMarkUnreadFrom">
    <ListRestart class="mr-2 size-4" />
    {{ t('series.follow.markUnreadFrom') }}
  </DropdownMenuItem>
</template>
