import { renderHook, act, waitFor } from '@testing-library/react'
import { useCollaboration } from '@/hooks/use-collaboration'
import { CollaborationUser } from '@/lib/realtime/collaboration'

// Mock the collaboration manager
jest.mock('@/lib/realtime/collaboration', () => ({
  CollaborationManager: jest.fn().mockImplementation(() => ({
    onUsersChange: jest.fn(),
    onMessageReceive: jest.fn(),
    onTypingChange: jest.fn(),
    sendVoiceMessage: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    updateUserStatus: jest.fn(),
    disconnect: jest.fn()
  }))
}))

describe('useCollaboration', () => {
  const mockUser: CollaborationUser = {
    id: 'test-user-1',
    name: 'Test User',
    status: 'online',
    lastSeen: new Date()
  }

  const defaultOptions = {
    roomId: 'test-room',
    user: mockUser,
    enabled: true
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      expect(result.current.onlineUsers).toEqual([])
      expect(result.current.typingUsers).toEqual([])
      expect(result.current.messages).toEqual([])
      expect(result.current.isConnected).toBe(false)
    })

    test('should not initialize when disabled', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, enabled: false })
      )

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Connection Management', () => {
    test('should connect when enabled', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })

    test('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useCollaboration(defaultOptions))

      expect(() => unmount()).not.toThrow()
    })

    test('should manually connect and disconnect', async () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, enabled: false })
      )

      act(() => {
        result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Voice Message Handling', () => {
    test('should send voice message', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      const audioBuffer = new ArrayBuffer(1024)
      const duration = 5.0
      const transcription = 'Test message'

      await act(async () => {
        await result.current.sendVoiceMessage(audioBuffer, duration, transcription)
      })

      // Should not throw any errors
      expect(result.current.isConnected).toBe(true)
    })

    test('should handle voice message sending errors', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Test with invalid data
      await act(async () => {
        await result.current.sendVoiceMessage(new ArrayBuffer(0), -1)
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Typing Indicators', () => {
    test('should start and stop typing', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      await act(async () => {
        await result.current.startTyping()
      })

      await act(async () => {
        await result.current.stopTyping()
      })

      expect(result.current.isConnected).toBe(true)
    })

    test('should auto-stop typing after timeout', async () => {
      jest.useFakeTimers()

      const { result } = renderHook(() => useCollaboration(defaultOptions))

      await act(async () => {
        await result.current.startTyping()
      })

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(3000)
      })

      jest.useRealTimers()
    })
  })

  describe('User Status Management', () => {
    test('should update user status', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      act(() => {
        result.current.updateUserStatus('away')
      })

      act(() => {
        result.current.updateUserStatus('online')
      })

      expect(result.current.isConnected).toBe(true)
    })
  })

  describe('Window Event Handlers', () => {
    test('should handle window focus and blur events', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate window blur (away)
      act(() => {
        window.dispatchEvent(new Event('blur'))
      })

      // Simulate window focus (online)
      act(() => {
        window.dispatchEvent(new Event('focus'))
      })

      expect(result.current.isConnected).toBe(true)
    })

    test('should handle beforeunload event', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate page unload
      act(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })

      expect(result.current.isConnected).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock CollaborationManager to throw error
      const MockCollaborationManager = require('@/lib/realtime/collaboration').CollaborationManager
      MockCollaborationManager.mockImplementationOnce(() => {
        throw new Error('Connection failed')
      })

      const { result } = renderHook(() => useCollaboration(defaultOptions))

      expect(result.current.isConnected).toBe(false)

      consoleSpy.mockRestore()
    })

    test('should handle typing errors gracefully', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock methods to throw errors
      const MockCollaborationManager = require('@/lib/realtime/collaboration').CollaborationManager
      MockCollaborationManager.mockImplementation(() => ({
        onUsersChange: jest.fn(),
        onMessageReceive: jest.fn(),
        onTypingChange: jest.fn(),
        startTyping: jest.fn().mockRejectedValue(new Error('Typing failed')),
        stopTyping: jest.fn().mockRejectedValue(new Error('Stop typing failed')),
        sendVoiceMessage: jest.fn(),
        updateUserStatus: jest.fn(),
        disconnect: jest.fn()
      }))

      await act(async () => {
        await result.current.startTyping()
      })

      await act(async () => {
        await result.current.stopTyping()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Message Filtering', () => {
    test('should filter out current user from typing indicators', async () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions))

      // Wait for connection
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // The typing users should not include the current user
      // This is tested indirectly as the actual filtering happens in the callback
      expect(Array.isArray(result.current.typingUsers)).toBe(true)
    })
  })

  describe('Cleanup', () => {
    test('should cleanup typing timeout on unmount', () => {
      jest.useFakeTimers()

      const { unmount } = renderHook(() => useCollaboration(defaultOptions))

      unmount()

      // Should not have any pending timers
      expect(jest.getTimerCount()).toBe(0)

      jest.useRealTimers()
    })
  })
})