<script setup lang="ts">
/**
 * The Sign-in section every provider gets at the top of its settings page: one card holding
 * whichever `authMethods` the provider declares, collapsing to an account row once connected.
 * Built for the generic private-adapter page but usable standalone (see
 * `docs/AGENT_HANDOFF.md`'s design note for the state list this implements).
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, Unlink, XCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { ReadingServiceAuthMethod, ReadingServiceProvider } from '@bookorbit/types'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { SECRET_INPUT_ATTRS } from '@/lib/secret-input'
import { copyToClipboard } from '@/lib/clipboard'
import { useCountdown, useReadingServiceAuth } from '../composables/useReadingServiceAuth'

const props = defineProps<{
  /** Any provider id, including an arbitrary private-adapter one; narrowed only where the
   * composable/API layer requires the built-in-only `ReadingServiceProvider` literal union. */
  provider: string
  authMethods: ReadingServiceAuthMethod[]
  connected: boolean
  needsReconnect?: boolean
  accountLabel?: string | null
  /** Shown instead of `provider` in sentences that name the account; falls back to `provider`. */
  displayName?: string | null
}>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()

const auth = useReadingServiceAuth(props.provider as ReadingServiceProvider)

const providerLabel = computed(() => props.displayName || props.provider.charAt(0).toUpperCase() + props.provider.slice(1))

/** Reopens the method picker without disconnecting first ("Switch account"). */
const switching = ref(false)
const showMethods = computed(() => !props.connected || props.needsReconnect || switching.value)

watch(
  () => props.authMethods,
  (methods) => {
    if (methods.length === 1 && !auth.selectedMethod.value) {
      const only = methods[0]
      if (only) auth.selectMethod(only.kind)
    }
  },
  { immediate: true },
)

function methodLabel(method: ReadingServiceAuthMethod): string {
  return method.label
}

const activeMethod = computed(() => props.authMethods.find((m) => m.kind === auth.selectedMethod.value) ?? props.authMethods[0] ?? null)

// ── Token ──────────────────────────────────────────────────────────────────
const tokenInput = ref('')
const tokenVisible = ref(false)
const tokenSubmitDisabled = computed(() => auth.pending.value || tokenInput.value.trim().length === 0)

async function handleTokenSubmit(): Promise<void> {
  const value = tokenInput.value.trim()
  const ok = await auth.submitToken(value)
  tokenInput.value = ''
  if (ok) {
    switching.value = false
    toast.success(t('settings.readingServices.signIn.connectedToast', { provider: providerLabel.value }))
    emit('changed')
  }
}

// ── Password ───────────────────────────────────────────────────────────────
const usernameInput = ref('')
const passwordInput = ref('')
const passwordVisible = ref(false)
const passwordSubmitDisabled = computed(
  () => auth.pending.value || usernameInput.value.trim().length === 0 || passwordInput.value.length === 0,
)

const rateLimitCountdown = useCountdown(() => (auth.rateLimitedUntil.value ? new Date(auth.rateLimitedUntil.value).toISOString() : null))

async function handlePasswordSubmit(): Promise<void> {
  const username = usernameInput.value.trim()
  const password = passwordInput.value
  // Cleared before the request resolves: the component never holds a successfully-or-not
  // submitted password a moment longer than the single call that needs it.
  passwordInput.value = ''
  const ok = await auth.submitPassword(username, password)
  if (ok) {
    usernameInput.value = ''
    switching.value = false
    toast.success(t('settings.readingServices.signIn.connectedToast', { provider: providerLabel.value }))
    emit('changed')
  }
}

function passwordErrorText(): string {
  const reason = auth.passwordError.value
  if (!reason) return ''
  if (reason === 'rate_limited') {
    const seconds = rateLimitCountdown.secondsLeft
    return seconds > 0
      ? t('settings.readingServices.signIn.password.errors.rateLimited', { minutes: Math.ceil(seconds / 60) })
      : t('settings.readingServices.signIn.password.errors.rateLimitedNow')
  }
  return auth.passwordErrorMessage.value ?? t(`settings.readingServices.signIn.password.errors.${reason}`)
}

// ── Device code ────────────────────────────────────────────────────────────
const deviceCountdown = useCountdown(() => auth.deviceStart.value?.expiresAt ?? null)

async function copyDeviceCode(): Promise<void> {
  const code = auth.deviceStart.value?.userCode
  if (!code) return
  const copied = await copyToClipboard(code)
  if (copied) toast.success(t('settings.readingServices.signIn.device.copied'))
}

watch(
  () => auth.deviceState.value,
  (state) => {
    if (state === 'approved') {
      switching.value = false
      toast.success(t('settings.readingServices.signIn.connectedToast', { provider: providerLabel.value }))
      emit('changed')
    }
  },
)

// ── Connected / disconnect ─────────────────────────────────────────────────
const confirmingDisconnect = ref(false)

async function handleDisconnect(): Promise<void> {
  const ok = await auth.disconnect()
  confirmingDisconnect.value = false
  if (ok) {
    switching.value = false
    toast.success(t('settings.readingServices.signIn.connected.disconnectedToast', { provider: providerLabel.value }))
    emit('changed')
  }
}

function startSwitching(): void {
  switching.value = true
}
</script>

<template>
  <div class="border border-border rounded-lg bg-card px-4 py-4 md:px-5 md:py-5 shadow-xs space-y-4" data-testid="reading-service-sign-in">
    <h3 class="settings-group-label mb-0">{{ t('settings.readingServices.signIn.title') }}</h3>

    <div
      v-if="needsReconnect"
      class="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 py-2"
      data-testid="reading-service-needs-reconnect"
    >
      <RefreshCw class="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
      <p class="text-xs text-muted-foreground leading-relaxed">
        {{ t('settings.readingServices.signIn.reconnect.description', { provider: providerLabel }) }}
      </p>
    </div>

    <!-- Connected, collapsed -->
    <div v-if="connected && !showMethods" class="flex items-center justify-between gap-3" data-testid="reading-service-connected-row">
      <div class="flex items-center gap-2 min-w-0">
        <CheckCircle2 class="size-4 shrink-0 text-primary" />
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{{ accountLabel || providerLabel }}</p>
          <p class="text-xs text-muted-foreground">{{ t('settings.readingServices.signIn.connected.status') }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" type="button" data-testid="reading-service-switch-account" @click="startSwitching">
          {{ t('settings.readingServices.signIn.connected.switchAccount') }}
        </Button>
        <Button variant="destructive-ghost" size="sm" type="button" data-testid="reading-service-disconnect" @click="confirmingDisconnect = true">
          <Unlink class="size-3.5" />
          {{ t('settings.readingServices.signIn.connected.disconnect') }}
        </Button>
      </div>
    </div>

    <!-- Method picker + forms -->
    <div v-else class="space-y-4" data-testid="reading-service-sign-in-methods">
      <div v-if="authMethods.length > 1" class="flex flex-wrap gap-1 rounded-md bg-muted/50 p-1" role="radiogroup" :aria-label="t('settings.readingServices.signIn.methodPrompt')">
        <button
          v-for="method in authMethods"
          :key="method.kind"
          type="button"
          role="radio"
          :aria-checked="auth.selectedMethod.value === method.kind"
          class="flex-1 rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="auth.selectedMethod.value === method.kind ? 'bg-background shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'"
          data-testid="reading-service-auth-method-option"
          @click="auth.selectMethod(method.kind)"
        >
          {{ methodLabel(method) }}
        </button>
      </div>

      <p v-if="activeMethod?.help" class="text-xs text-muted-foreground">{{ activeMethod.help }}</p>

      <!-- Token -->
      <div v-if="activeMethod?.kind === 'token'" class="space-y-3" data-testid="reading-service-token-form">
        <div class="space-y-2">
          <label :for="`reading-service-${provider}-token`" class="settings-label">{{ activeMethod.label }}</label>
          <div class="flex gap-2">
            <input
              :id="`reading-service-${provider}-token`"
              v-model="tokenInput"
              v-bind="SECRET_INPUT_ATTRS"
              type="text"
              :placeholder="activeMethod.placeholder"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              :class="{ 'input-secret': !tokenVisible }"
              @keydown.enter="handleTokenSubmit"
            />
            <Button variant="outline" size="sm" type="button" @click="tokenVisible = !tokenVisible">
              {{ tokenVisible ? t('common.hide') : t('common.show') }}
            </Button>
          </div>
        </div>
        <div v-if="auth.tokenError.value" class="flex items-start gap-2 text-xs text-destructive" data-testid="reading-service-token-error">
          <AlertCircle class="size-3.5 shrink-0 mt-0.5" />
          <p>{{ auth.tokenError.value }}</p>
        </div>
        <Button size="sm" type="button" :disabled="tokenSubmitDisabled" data-testid="reading-service-token-submit" @click="handleTokenSubmit">
          <Loader2 v-if="auth.pending.value" class="size-3.5 animate-spin" />
          {{ t('settings.readingServices.signIn.token.submit') }}
        </Button>
      </div>

      <!-- Password -->
      <form v-else-if="activeMethod?.kind === 'password'" class="space-y-3" data-testid="reading-service-password-form" @submit.prevent="handlePasswordSubmit">
        <div class="space-y-2">
          <label :for="`reading-service-${provider}-username`" class="settings-label">{{ activeMethod.fields.username.label }}</label>
          <input
            :id="`reading-service-${provider}-username`"
            v-model="usernameInput"
            type="text"
            autocomplete="username"
            :placeholder="activeMethod.fields.username.placeholder"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div class="space-y-2">
          <label :for="`reading-service-${provider}-password`" class="settings-label">{{ activeMethod.fields.password.label }}</label>
          <div class="flex gap-2">
            <input
              :id="`reading-service-${provider}-password`"
              v-model="passwordInput"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              :placeholder="activeMethod.fields.password.placeholder"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button variant="outline" size="sm" type="button" @click="passwordVisible = !passwordVisible">
              {{ passwordVisible ? t('common.hide') : t('common.show') }}
            </Button>
          </div>
        </div>
        <div v-if="auth.passwordError.value" class="flex items-start gap-2 text-xs text-destructive" data-testid="reading-service-password-error">
          <AlertCircle class="size-3.5 shrink-0 mt-0.5" />
          <p>{{ passwordErrorText() }}</p>
        </div>
        <Button size="sm" type="submit" :disabled="passwordSubmitDisabled" data-testid="reading-service-password-submit">
          <Loader2 v-if="auth.pending.value" class="size-3.5 animate-spin" />
          {{ t('settings.readingServices.signIn.password.submit') }}
        </Button>
      </form>

      <!-- Device code -->
      <div v-else-if="activeMethod?.kind === 'device_code'" class="space-y-3" data-testid="reading-service-device-form">
        <div v-if="auth.deviceState.value === 'idle'">
          <Button size="sm" type="button" :disabled="auth.pending.value" data-testid="reading-service-device-start" @click="auth.startDevice">
            <Loader2 v-if="auth.pending.value" class="size-3.5 animate-spin" />
            {{ t('settings.readingServices.signIn.device.start') }}
          </Button>
        </div>

        <div v-else-if="auth.deviceState.value === 'waiting'" class="space-y-3" data-testid="reading-service-device-waiting">
          <p class="text-sm">{{ t('settings.readingServices.signIn.device.instructions') }}</p>
          <div class="flex items-center gap-2">
            <span class="rounded-md bg-muted px-3 py-2 text-lg font-semibold tracking-widest tabular-nums" data-testid="reading-service-device-code">
              {{ auth.deviceStart.value?.userCode }}
            </span>
            <Button variant="outline" size="icon-sm" type="button" :aria-label="t('settings.readingServices.signIn.device.copy')" @click="copyDeviceCode">
              <Copy class="size-3.5" />
            </Button>
          </div>
          <a
            v-if="auth.deviceStart.value"
            :href="auth.deviceStart.value.verificationUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
          >
            {{ t('settings.readingServices.signIn.device.openLink') }}
            <ExternalLink class="size-3.5" />
          </a>
          <p class="text-xs text-muted-foreground" data-testid="reading-service-device-countdown">
            {{ t('settings.readingServices.signIn.device.expiresIn', { seconds: deviceCountdown.secondsLeft }) }}
          </p>
          <Button variant="outline" size="sm" type="button" @click="auth.cancelDevice">
            {{ t('common.cancel') }}
          </Button>
        </div>

        <div v-else-if="auth.deviceState.value === 'expired'" class="space-y-2" data-testid="reading-service-device-expired">
          <div class="flex items-start gap-2 text-xs text-muted-foreground">
            <XCircle class="size-3.5 shrink-0 mt-0.5" />
            <p>{{ t('settings.readingServices.signIn.device.expired') }}</p>
          </div>
          <Button variant="outline" size="sm" type="button" @click="auth.retryDevice">{{ t('settings.readingServices.signIn.device.retry') }}</Button>
        </div>

        <div v-else-if="auth.deviceState.value === 'denied'" class="space-y-2" data-testid="reading-service-device-denied">
          <div class="flex items-start gap-2 text-xs text-destructive">
            <XCircle class="size-3.5 shrink-0 mt-0.5" />
            <p>{{ auth.deviceMessage.value || t('settings.readingServices.signIn.device.denied') }}</p>
          </div>
          <Button variant="outline" size="sm" type="button" @click="auth.retryDevice">{{ t('settings.readingServices.signIn.device.retry') }}</Button>
        </div>

        <div v-else-if="auth.deviceState.value === 'error'" class="space-y-2" data-testid="reading-service-device-error">
          <div class="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle class="size-3.5 shrink-0 mt-0.5" />
            <p>{{ auth.deviceMessage.value || t('settings.readingServices.signIn.device.error') }}</p>
          </div>
          <Button variant="outline" size="sm" type="button" @click="auth.retryDevice">{{ t('settings.readingServices.signIn.device.retry') }}</Button>
        </div>
      </div>

      <div v-if="connected" class="pt-2 border-t border-border">
        <Button variant="ghost" size="sm" type="button" @click="switching = false">{{ t('common.cancel') }}</Button>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmingDisconnect"
      :title="t('settings.readingServices.signIn.connected.disconnectConfirmTitle', { provider: providerLabel })"
      :description="t('settings.readingServices.signIn.connected.disconnectConfirmDescription')"
      :confirm-label="t('settings.readingServices.signIn.connected.disconnect')"
      :busy="auth.disconnecting.value"
      destructive
      @confirm="handleDisconnect"
      @cancel="confirmingDisconnect = false"
    />
  </div>
</template>
