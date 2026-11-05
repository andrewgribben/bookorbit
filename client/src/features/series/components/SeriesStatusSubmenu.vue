<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ListOrdered } from '@lucide/vue'

import { SERIES_FOLLOW_STATUSES, type SeriesFollowStatus } from '@bookorbit/types'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { seriesFollowStatusLabelKey } from '../lib/series-follow-status'

const emit = defineEmits<{ select: [status: SeriesFollowStatus | null] }>()

const { t } = useI18n()

function handleSelect(status: SeriesFollowStatus) {
  emit('select', status)
}

function handleClear() {
  emit('select', null)
}
</script>

<template>
  <DropdownMenuSeparator />
  <DropdownMenuSub>
    <DropdownMenuSubTrigger data-testid="series-status-submenu">
      <ListOrdered class="mr-2 size-4" />
      {{ t('series.follow.label') }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      <DropdownMenuItem v-for="option in SERIES_FOLLOW_STATUSES" :key="option" :data-testid="`series-status-${option}`" @click="handleSelect(option)">
        {{ t(seriesFollowStatusLabelKey(option)) }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem data-testid="series-status-none" @click="handleClear">
        {{ t('series.follow.none') }}
      </DropdownMenuItem>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
