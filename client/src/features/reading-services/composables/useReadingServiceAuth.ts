import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import type { ReadingServiceAuthMethod, ReadingServiceDeviceAuthStart, ReadingServiceProvider } from '@bookorbit/types'
import {
  connectReadingServiceWithPassword,
  connectReadingServiceWithToken,
  disconnectReadingService,
  pollReadingServiceDeviceAuth,
  startReadingServiceDeviceAuth,
  ReadingServiceAuthRateLimitedError,
} from '../api/reading-service-auth.api'

export type DeviceAuthState = 'idle' | 'waiting' | 'approved' | 'expired' | 'denied' | 'error'

export type PasswordErrorReason = 'invalid' | 'mfa_required' | 'network' | 'unsupported' | 'rate_limited'

/**
 * Drives one provider's Sign-in section: picking a method, submitting it, and the device-code
 * poll loop. A fresh instance per `<ReadingServiceSignIn>` mount (unlike `useReadingServices`,
 * whose summary state is shared app-wide) since only one sign-in attempt happens at a time.
 */
export function useReadingServiceAuth(provider: ReadingServiceProvider) {
  const selectedMethod = ref<ReadingServiceAuthMethod['kind'] | null>(null)
  const pending = ref(false)

  const tokenError = ref<string | null>(null)

  const passwordError = ref<PasswordErrorReason | null>(null)
  const passwordErrorMessage = ref<string | null>(null)
  const rateLimitedUntil = ref<number | null>(null)
  // The password field itself lives in the component; this composable only ever sees it for the
  // duration of one submit call and never stores it past that.

  const deviceState = ref<DeviceAuthState>('idle')
  const deviceStart = ref<ReadingServiceDeviceAuthStart | null>(null)
  const deviceMessage = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function selectMethod(kind: ReadingServiceAuthMethod['kind']): void {
    selectedMethod.value = kind
    tokenError.value = null
    passwordError.value = null
    passwordErrorMessage.value = null
  }

  async function submitToken(credential: string): Promise<boolean> {
    tokenError.value = null
    pending.value = true
    try {
      const result = await connectReadingServiceWithToken(provider, credential)
      return result.ok
    } catch (err) {
      tokenError.value = err instanceof Error ? err.message : 'Could not connect with that token'
      return false
    } finally {
      pending.value = false
    }
  }

  /** The password argument is read once and never assigned to any ref on this composable. */
  async function submitPassword(username: string, password: string): Promise<boolean> {
    passwordError.value = null
    passwordErrorMessage.value = null
    pending.value = true
    try {
      const result = await connectReadingServiceWithPassword(provider, username, password)
      if (!result.ok) {
        passwordError.value = result.reason
        passwordErrorMessage.value = result.message ?? null
        return false
      }
      return true
    } catch (err) {
      if (err instanceof ReadingServiceAuthRateLimitedError) {
        passwordError.value = 'rate_limited'
        rateLimitedUntil.value = err.retryAfterSeconds ? Date.now() + err.retryAfterSeconds * 1000 : null
      } else {
        passwordError.value = 'network'
        passwordErrorMessage.value = err instanceof Error ? err.message : null
      }
      return false
    } finally {
      pending.value = false
    }
  }

  function clearPollTimer(): void {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  async function pollOnce(): Promise<void> {
    if (!deviceStart.value) return
    try {
      const result = await pollReadingServiceDeviceAuth(provider)
      if (result.status === 'pending') {
        if (Date.now() >= new Date(deviceStart.value.expiresAt).getTime()) {
          deviceState.value = 'expired'
          return
        }
        pollTimer = setTimeout(() => void pollOnce(), deviceStart.value.pollIntervalSeconds * 1000)
        return
      }
      deviceMessage.value = result.message ?? null
      deviceState.value = result.status
    } catch {
      deviceState.value = 'error'
    }
  }

  async function startDevice(): Promise<void> {
    deviceState.value = 'waiting'
    deviceMessage.value = null
    pending.value = true
    try {
      deviceStart.value = await startReadingServiceDeviceAuth(provider)
      pending.value = false
      void pollOnce()
    } catch (err) {
      pending.value = false
      deviceState.value = 'error'
      deviceMessage.value = err instanceof Error ? err.message : null
    }
  }

  function cancelDevice(): void {
    clearPollTimer()
    deviceState.value = 'idle'
    deviceStart.value = null
    deviceMessage.value = null
  }

  function retryDevice(): void {
    deviceState.value = 'idle'
    deviceStart.value = null
    deviceMessage.value = null
  }

  const disconnecting = ref(false)
  async function disconnect(): Promise<boolean> {
    disconnecting.value = true
    try {
      await disconnectReadingService(provider)
      return true
    } finally {
      disconnecting.value = false
    }
  }

  onBeforeUnmount(clearPollTimer)

  return {
    selectedMethod,
    pending,
    tokenError,
    passwordError,
    passwordErrorMessage,
    rateLimitedUntil,
    deviceState,
    deviceStart,
    deviceMessage,
    disconnecting,
    selectMethod,
    submitToken,
    submitPassword,
    startDevice,
    cancelDevice,
    retryDevice,
    disconnect,
  }
}

/** Shared reactive countdown helper for the device-code screen's "expires in" sentence. */
export function useCountdown(targetIso: () => string | null) {
  const now = ref(Date.now())
  const timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  onBeforeUnmount(() => clearInterval(timer))

  const secondsLeft = computed(() => {
    const target = targetIso()
    if (!target) return 0
    return Math.max(0, Math.round((new Date(target).getTime() - now.value) / 1000))
  })

  return reactive({ secondsLeft })
}
