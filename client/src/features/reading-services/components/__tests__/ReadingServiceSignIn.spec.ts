import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { ReadingServiceAuthMethod } from '@bookorbit/types'
import ReadingServiceSignIn from '../ReadingServiceSignIn.vue'

const mocks = vi.hoisted(() => ({
  connectReadingServiceWithToken: vi.fn<(...args: unknown[]) => unknown>(),
  connectReadingServiceWithPassword: vi.fn<(...args: unknown[]) => unknown>(),
  startReadingServiceDeviceAuth: vi.fn<(...args: unknown[]) => unknown>(),
  pollReadingServiceDeviceAuth: vi.fn<(...args: unknown[]) => unknown>(),
  disconnectReadingService: vi.fn<(...args: unknown[]) => unknown>(),
}))

const toastSuccess = vi.hoisted(() => vi.fn<(...args: unknown[]) => unknown>())

vi.mock('../../api/reading-service-auth.api', async () => {
  const actual = await vi.importActual<typeof import('../../api/reading-service-auth.api')>('../../api/reading-service-auth.api')
  return {
    ...actual,
    connectReadingServiceWithToken: mocks.connectReadingServiceWithToken,
    connectReadingServiceWithPassword: mocks.connectReadingServiceWithPassword,
    startReadingServiceDeviceAuth: mocks.startReadingServiceDeviceAuth,
    pollReadingServiceDeviceAuth: mocks.pollReadingServiceDeviceAuth,
    disconnectReadingService: mocks.disconnectReadingService,
  }
})

vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: vi.fn<(...args: unknown[]) => unknown>() } }))

const TOKEN_METHOD: ReadingServiceAuthMethod = { kind: 'token', label: 'API token', help: 'Paste it here' }
const PASSWORD_METHOD: ReadingServiceAuthMethod = {
  kind: 'password',
  label: 'Username and password',
  fields: { username: { label: 'Username' }, password: { label: 'Password' } },
}
const DEVICE_METHOD: ReadingServiceAuthMethod = { kind: 'device_code', label: 'Device code' }

type SignInProps = {
  provider: string
  authMethods: ReadingServiceAuthMethod[]
  connected: boolean
  needsReconnect?: boolean
  accountLabel?: string | null
  displayName?: string | null
}

let wrappers: ReturnType<typeof mount>[] = []

function mountSignIn(props: SignInProps, options: Record<string, unknown> = {}) {
  const wrapper = mount(ReadingServiceSignIn, { props, ...options })
  wrappers.push(wrapper)
  return wrapper
}

describe('ReadingServiceSignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // The countdown helpers run a real `setInterval`; unmounting clears it so it never leaks
    // into a later test or keeps the test process alive.
    for (const wrapper of wrappers) wrapper.unmount()
    wrappers = []
    vi.restoreAllMocks()
  })

  it('renders the token form directly when it is the only method, disables submit until filled', async () => {
    mocks.connectReadingServiceWithToken.mockResolvedValue({ ok: true, accountLabel: 'reader-1' })
    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [TOKEN_METHOD], connected: false })

    expect(wrapper.find('[data-testid="reading-service-auth-method-option"]').exists()).toBe(false)
    const submit = wrapper.get('[data-testid="reading-service-token-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('secret-token')
    expect(submit.attributes('disabled')).toBeUndefined()

    await submit.trigger('click')
    await flushPromises()

    expect(mocks.connectReadingServiceWithToken).toHaveBeenCalledWith('fixturewise', 'secret-token')
    expect(wrapper.emitted('changed')).toBeTruthy()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('shows a segmented picker for more than one method, in declared order', () => {
    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [TOKEN_METHOD, PASSWORD_METHOD], connected: false })

    const options = wrapper.findAll('[data-testid="reading-service-auth-method-option"]')
    expect(options.map((option) => option.text())).toEqual(['API token', 'Username and password'])
  })

  it('submits the password form, clears the password input immediately, and surfaces the invalid reason', async () => {
    mocks.connectReadingServiceWithPassword.mockResolvedValue({ ok: false, reason: 'invalid' })
    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [PASSWORD_METHOD], connected: false })

    const username = wrapper.get('input[autocomplete="username"]')
    const password = wrapper.get('input[autocomplete="current-password"]')
    expect(password.attributes('type')).toBe('password')

    await username.setValue('reader')
    await password.setValue('wrong-password')
    await wrapper.get('form').trigger('submit')

    // Cleared synchronously, before the mocked API call even resolves.
    expect((password.element as HTMLInputElement).value).toBe('')

    await flushPromises()

    expect(mocks.connectReadingServiceWithPassword).toHaveBeenCalledWith('fixturewise', 'reader', 'wrong-password')
    expect(wrapper.get('[data-testid="reading-service-password-error"]').text()).toContain("wasn't right")
    expect(wrapper.emitted('changed')).toBeFalsy()
  })

  it('renders the password form with default labels when the adapter declares no fields', () => {
    const bare = { kind: 'password', label: 'Email and password' } as ReadingServiceAuthMethod
    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [bare], connected: false })
    const form = wrapper.find('[data-testid="reading-service-password-form"]')
    expect(form.exists()).toBe(true)
    expect(form.find('input[autocomplete="username"]').exists()).toBe(true)
    expect(form.find('input[autocomplete="current-password"]').exists()).toBe(true)
  })

  it('shows the waiting code, link and countdown while a device-code sign-in is pending', async () => {
    mocks.startReadingServiceDeviceAuth.mockResolvedValue({
      verificationUrl: 'https://example.com/device',
      userCode: 'ABCD-1234',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      pollIntervalSeconds: 5,
    })
    // Never resolves, so the component stays in 'waiting' for this assertion - a resolved poll
    // would carry the UI straight through to 'approved' within the same microtask flush.
    mocks.pollReadingServiceDeviceAuth.mockReturnValue(new Promise(() => {}))

    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [DEVICE_METHOD], connected: false })

    await wrapper.get('[data-testid="reading-service-device-start"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="reading-service-device-code"]').text()).toBe('ABCD-1234')
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('https://example.com/device')
    expect(link.attributes('target')).toBe('_blank')
    expect(wrapper.get('[data-testid="reading-service-device-countdown"]').text()).toContain('60s')
  })

  it('emits changed once the device-code poll reports approved', async () => {
    mocks.startReadingServiceDeviceAuth.mockResolvedValue({
      verificationUrl: 'https://example.com/device',
      userCode: 'ABCD-1234',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      pollIntervalSeconds: 5,
    })
    mocks.pollReadingServiceDeviceAuth.mockResolvedValue({ status: 'approved', accountLabel: 'reader-1' })

    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [DEVICE_METHOD], connected: false })

    await wrapper.get('[data-testid="reading-service-device-start"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('changed')).toBeTruthy()
  })

  it('collapses to an account row once connected, and Switch account reopens the methods', async () => {
    const wrapper = mountSignIn({ provider: 'fixturewise', authMethods: [TOKEN_METHOD], connected: true, accountLabel: 'reader-1' })

    expect(wrapper.get('[data-testid="reading-service-connected-row"]').text()).toContain('reader-1')
    expect(wrapper.find('[data-testid="reading-service-sign-in-methods"]').exists()).toBe(false)

    await wrapper.get('[data-testid="reading-service-switch-account"]').trigger('click')

    expect(wrapper.find('[data-testid="reading-service-connected-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reading-service-sign-in-methods"]').exists()).toBe(true)
  })

  it('opens a confirm dialog before disconnecting', async () => {
    mocks.disconnectReadingService.mockResolvedValue({ ok: true })
    const wrapper = mountSignIn(
      { provider: 'fixturewise', authMethods: [TOKEN_METHOD], connected: true, accountLabel: 'reader-1' },
      { attachTo: document.body },
    )

    await wrapper.get('[data-testid="reading-service-disconnect"]').trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Disconnect Fixturewise?')
  })

  it('shows a calm reconnect notice and reopens the sign-in methods when needsReconnect is true', () => {
    const wrapper = mountSignIn({
      provider: 'fixturewise',
      authMethods: [TOKEN_METHOD],
      connected: true,
      needsReconnect: true,
      accountLabel: 'reader-1',
    })

    expect(wrapper.find('[data-testid="reading-service-needs-reconnect"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reading-service-connected-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reading-service-sign-in-methods"]').exists()).toBe(true)
  })
})
