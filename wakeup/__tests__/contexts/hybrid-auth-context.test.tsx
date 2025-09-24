import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { HybridAuthProvider, useAuth } from '@/contexts/hybrid-auth-context'

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
  }
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <HybridAuthProvider>{children}</HybridAuthProvider>
)

describe('HybridAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset localStorage
    global.localStorage.clear()
  })

  it('initializes with loading state', () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.isOfflineMode).toBe(false)
  })

  it('sets user when Supabase session exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } }
    })

    const mockSubscription = { unsubscribe: jest.fn() }
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isOffline: false
    })
    expect(result.current.isOfflineMode).toBe(false)
  })

  it('falls back to offline mode when Supabase is unavailable', async () => {
    mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'))
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    // Mock offline user in localStorage
    global.localStorage.setItem('offline-user', JSON.stringify({
      id: 'offline-user',
      email: 'offline@test.com',
      name: 'Offline User'
    }))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.isOfflineMode).toBe(true)
    expect(result.current.user).toEqual({
      id: 'offline-user',
      email: 'offline@test.com',
      name: 'Offline User',
      isOffline: true
    })
  })

  it('handles sign in successfully', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token' }
      },
      error: null
    })

    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let signInResult
    await act(async () => {
      signInResult = await result.current.signIn('test@example.com', 'password')
    })

    expect(signInResult).toEqual({ success: true })
    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password'
    })
  })

  it('handles sign in error', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' }
    })

    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let signInResult
    await act(async () => {
      signInResult = await result.current.signIn('test@example.com', 'wrongpassword')
    })

    expect(signInResult).toEqual({
      success: false,
      error: 'Invalid credentials'
    })
  })

  it('handles offline sign in', async () => {
    mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'))
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    let signInResult
    await act(async () => {
      signInResult = await result.current.signIn('test@example.com', 'password')
    })

    expect(signInResult).toEqual({ success: true })
    expect(result.current.user?.isOffline).toBe(true)
    expect(result.current.isOfflineMode).toBe(true)
  })

  it('handles sign out', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null })
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123', email: 'test@example.com' } } }
    })
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('offline-user')
  })

  it('switches between online and offline modes', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.switchToOfflineMode()
    })

    expect(result.current.isOfflineMode).toBe(true)

    await act(async () => {
      result.current.switchToOnlineMode()
    })

    expect(result.current.isOfflineMode).toBe(false)
  })

  it('throws error when useAuth is used outside provider', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })
})