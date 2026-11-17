<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link, Save, CheckCircle2, AlertCircle, Info, Loader2, History } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { TkBackfillPreview, TkSyncDisabledReason } from '@bookorbit/types'
import SettingsPageHeader from '@/features/settings/SettingsPageHeader.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useTkSettings } from '../composables/useTkSettings'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})
const { t } = useI18n()

const { settings, saving, connecting, error, fetchSettings, saveSettings, connectStart, connectFinish, disconnect, previewBackfill, startBackfill } =
  useTkSettings()

const form = reactive({ enabled: false })
const callbackUrlInput = ref('')
const awaitingCallback = ref(false)
const backfillPreview = ref<TkBackfillPreview | null>(null)
const backfillLoading = ref(false)

const disabledReasonMessages: Record<TkSyncDisabledReason, string> = {
  permission_denied: "Your account doesn't have TK sync permission.",
  missing_token: 'Connect your TK account to start syncing.',
  invalid_token: 'Your TK connection was rejected. Reconnect to keep syncing.',
  daily_note_shared: 'A daily note is shared, so BookOrbit skipped writing to it. Unshare it to resume.',
}

onMounted(async () => {
  await fetchSettings()
  form.enabled = settings.value?.enabled ?? false
  if (settings.value?.connected) await loadBackfillPreview()
})

async function loadBackfillPreview() {
  backfillLoading.value = true
  backfillPreview.value = await previewBackfill()
  backfillLoading.value = false
}

async function handleConnectStart() {
  const authorizeUrl = await connectStart()
  if (!authorizeUrl) {
    toast.error(error.value ?? 'Failed to start connecting TK')
    return
  }
  window.open(authorizeUrl, '_blank', 'noopener')
  awaitingCallback.value = true
}

async function handleConnectFinish() {
  const callbackUrl = callbackUrlInput.value.trim()
  if (!callbackUrl) {
    toast.error('Paste the address-bar URL from the browser tab TK opened')
    return
  }
  const ok = await connectFinish(callbackUrl)
  if (ok) {
    callbackUrlInput.value = ''
    awaitingCallback.value = false
    toast.success('TK connected')
    await loadBackfillPreview()
  } else {
    toast.error(error.value ?? 'Failed to finish connecting TK')
  }
}

async function handleDisconnect() {
  const ok = await disconnect()
  if (ok) {
    backfillPreview.value = null
    toast.success('TK disconnected')
  } else {
    toast.error(error.value ?? 'Failed to disconnect TK')
  }
}

async function handleSave() {
  const ok = await saveSettings({ enabled: form.enabled })
  if (ok) toast.success('TK settings saved')
  else toast.error(error.value ?? 'Failed to save settings')
}

async function handleStartBackfill() {
  const ok = await startBackfill()
  if (ok) {
    toast.success('Backfill started. It runs in the background and never duplicates items already sent.')
    await loadBackfillPreview()
  } else {
    toast.error(error.value ?? 'Failed to start backfill')
  }
}
</script>

<template>
  <div class="space-y-6">
    <SettingsPageHeader
      v-if="!props.embedded"
      :title="t('settings.integrations.tabs.tk')"
      :subtitle="t('settings.integrations.providerSubtitles.tk')"
    />

    <div class="border border-border rounded-lg bg-card px-4 py-4 md:px-5 md:py-5 shadow-xs space-y-5">
      <div class="flex items-center gap-3">
        <Link class="size-5 text-primary shrink-0" />
        <div>
          <p class="font-medium text-sm">Connection</p>
          <p class="text-xs text-muted-foreground mt-0.5">Connect your TK account to sync your daily notes.</p>
        </div>
        <div v-if="settings?.connected" class="ml-auto flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 class="size-3.5" />
          Connected
        </div>
      </div>

      <div v-if="error" class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2">
        <AlertCircle class="size-3.5 shrink-0 text-destructive mt-0.5" />
        <p class="text-xs text-destructive leading-relaxed">{{ error }}</p>
      </div>

      <div v-if="settings?.disabledReason" class="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 py-2">
        <Info class="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
        <p class="text-xs text-muted-foreground leading-relaxed">{{ disabledReasonMessages[settings.disabledReason] }}</p>
      </div>

      <div v-if="settings?.connected" class="flex items-center justify-between" data-testid="tk-connected-row">
        <p class="text-sm text-muted-foreground">Your TK account is connected.</p>
        <Button variant="outline" size="sm" type="button" :disabled="saving" @click="handleDisconnect">Disconnect</Button>
      </div>

      <template v-else>
        <p class="text-xs text-muted-foreground leading-relaxed">
          TK only accepts sign-in on your own machine, so this opens a new tab. After you sign in, that tab will show a connection error page, which
          is expected: copy its full address-bar URL and paste it below.
        </p>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" :disabled="connecting" @click="handleConnectStart">
            <Loader2 v-if="connecting" class="size-3 animate-spin" />
            Connect TK
          </Button>
        </div>

        <div v-if="awaitingCallback" class="space-y-2">
          <label for="tk-callback-url" class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paste the address-bar URL</label>
          <div class="flex gap-2">
            <input
              id="tk-callback-url"
              v-model="callbackUrlInput"
              type="text"
              placeholder="http://127.0.0.1:53682/callback?code=...&state=..."
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button size="sm" type="button" :disabled="connecting" @click="handleConnectFinish">Finish connecting</Button>
          </div>
        </div>
      </template>

      <div class="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <p class="text-sm">Enable sync</p>
          <p class="text-xs text-muted-foreground mt-0.5">Automatically send new highlights, journal entries and finished books to TK.</p>
        </div>
        <ToggleSwitch v-model="form.enabled" />
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button size="sm" type="button" :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="size-3.5 animate-spin" />
          <Save v-else class="size-3.5" />
          Save
        </Button>
      </div>
    </div>

    <div
      v-if="settings?.connected"
      class="border border-border rounded-lg bg-card px-4 py-4 md:px-5 md:py-5 shadow-xs space-y-3"
      data-testid="tk-backfill-card"
    >
      <div class="flex items-center gap-3">
        <History class="size-5 text-primary shrink-0" />
        <div>
          <p class="font-medium text-sm">Backfill</p>
          <p class="text-xs text-muted-foreground mt-0.5">Send your full history to TK. This cannot be undone.</p>
        </div>
      </div>

      <p v-if="backfillLoading" class="text-xs text-muted-foreground">Checking how much there is to send...</p>
      <p v-else-if="backfillPreview && backfillPreview.itemCount > 0" class="text-sm">
        Backfill: {{ backfillPreview.itemCount }} items across {{ backfillPreview.dayCount }} days, oldest {{ backfillPreview.oldestDateKey }}.
      </p>
      <p v-else-if="backfillPreview" class="text-xs text-muted-foreground">Nothing older than your connection date is waiting to be sent.</p>

      <p v-if="settings.backfillRequestedAt" class="text-xs text-muted-foreground">
        Backfill requested; items older than when you connected are now being sent in the background.
      </p>
      <Button
        v-else
        variant="outline"
        size="sm"
        type="button"
        :disabled="saving || !backfillPreview || backfillPreview.itemCount === 0"
        @click="handleStartBackfill"
      >
        Send history to TK
      </Button>
    </div>
  </div>
</template>
