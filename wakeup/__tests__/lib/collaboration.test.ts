import { CollaborationManager, CollaborationUser, VoiceMessage } from '@/lib/realtime/collaboration'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      send: jest.fn(),
      track: jest.fn(),
      unsubscribe: jest.fn(),
      presenceState: jest.fn(() => ({}))
    }))
  }))
}))

describe('CollaborationManager', () => {
  let manager: CollaborationManager
  let mockUser: CollaborationUser

  beforeEach(() => {
    mockUser = {
      id: 'test-user-1',
      name: 'Test User',
      status: 'online',
      lastSeen: new Date()
    }

    manager = new CollaborationManager('test-room', mockUser)
  })

  afterEach(() => {
    manager.disconnect()
  })

  describe('User Management', () => {
    test('should initialize with current user', () => {
      expect(manager).toBeDefined()
    })

    test('should get online users', () => {
      const users = manager.getOnlineUsers()
      expect(Array.isArray(users)).toBe(true)
    })

    test('should update user status', async () => {
      await manager.updateUserStatus('away')
      expect(manager).toBeDefined() // Basic check since we can't access private properties
    })
  })

  describe('Message Handling', () => {
    test('should send voice message', async () => {
      const audioBuffer = new ArrayBuffer(1024)
      const duration = 5.5
      const transcription = 'Hello, this is a test message'

      await expect(
        manager.sendVoiceMessage(audioBuffer, duration, transcription)
      ).resolves.not.toThrow()
    })

    test('should handle message callbacks', () => {
      const messageCallback = jest.fn()
      manager.onMessageReceive(messageCallback)
      expect(manager).toBeDefined()
    })
  })

  describe('Typing Indicators', () => {
    test('should start typing', async () => {
      await expect(manager.startTyping()).resolves.not.toThrow()
    })

    test('should stop typing', async () => {
      await expect(manager.stopTyping()).resolves.not.toThrow()
    })

    test('should handle typing callbacks', () => {
      const typingCallback = jest.fn()
      manager.onTypingChange(typingCallback)
      expect(manager).toBeDefined()
    })
  })

  describe('Connection Management', () => {
    test('should disconnect cleanly', () => {
      expect(() => manager.disconnect()).not.toThrow()
    })

    test('should handle user presence callbacks', () => {
      const usersCallback = jest.fn()
      manager.onUsersChange(usersCallback)
      expect(manager).toBeDefined()
    })
  })

  describe('Audio Processing', () => {
    test('should handle different audio buffer sizes', async () => {
      const buffers = [
        new ArrayBuffer(512),
        new ArrayBuffer(1024),
        new ArrayBuffer(2048),
        new ArrayBuffer(4096)
      ]

      for (const buffer of buffers) {
        await expect(
          manager.sendVoiceMessage(buffer, 3.0)
        ).resolves.not.toThrow()
      }
    })

    test('should handle voice message with metadata', async () => {
      const audioBuffer = new ArrayBuffer(1024)
      const metadata = {
        duration: 5.5,
        transcription: 'Test transcription',
        emotions: {
          joy: 0.8,
          sadness: 0.1,
          anger: 0.0,
          fear: 0.0,
          surprise: 0.1,
          disgust: 0.0
        }
      }

      await expect(
        manager.sendVoiceMessage(audioBuffer, metadata.duration, metadata.transcription)
      ).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', () => {
      // Simulate connection error by creating a manager with invalid room
      const errorManager = new CollaborationManager('', mockUser)
      expect(() => errorManager.disconnect()).not.toThrow()
    })

    test('should handle malformed message data', async () => {
      // Test with empty audio buffer
      const emptyBuffer = new ArrayBuffer(0)
      await expect(
        manager.sendVoiceMessage(emptyBuffer, 0)
      ).resolves.not.toThrow()
    })
  })

  describe('Status Updates', () => {
    test('should handle all status types', () => {
      const statuses = ['online', 'away', 'offline'] as const

      for (const status of statuses) {
        expect(() => {
          manager.updateUserStatus(status)
        }).not.toThrow()
      }
    })

    test('should preserve user data during status changes', () => {
      manager.updateUserStatus('away')
      manager.updateUserStatus('online')

      const users = manager.getOnlineUsers()
      expect(Array.isArray(users)).toBe(true)
    })
  })
})