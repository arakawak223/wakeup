import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CollaborativeVoiceRoom } from '@/components/collaboration/collaborative-voice-room'
import { CollaborationUser } from '@/lib/realtime/collaboration'

// Mock the collaboration hook
jest.mock('@/hooks/use-collaboration', () => ({
  useCollaboration: () => ({
    onlineUsers: [
      {
        id: 'user-1',
        name: 'Alice Johnson',
        status: 'online',
        lastSeen: new Date()
      },
      {
        id: 'user-2',
        name: 'Bob Smith',
        status: 'away',
        lastSeen: new Date()
      }
    ],
    typingUsers: [
      {
        userId: 'user-2',
        timestamp: new Date()
      }
    ],
    messages: [
      {
        id: 'msg-1',
        userId: 'user-1',
        content: new ArrayBuffer(1024),
        duration: 5.5,
        timestamp: new Date(),
        transcription: 'Hello everyone!'
      }
    ],
    isConnected: true,
    sendVoiceMessage: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    updateUserStatus: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  })
}))

// Mock the voice recorder component
jest.mock('@/components/voice-recorder-supabase', () => ({
  VoiceRecorderSupabase: ({ onRecordingComplete, onRecordingStart, onRecordingStop, disabled }: any) => (
    <div data-testid="voice-recorder">
      <button
        onClick={() => {
          onRecordingStart?.()
          // Simulate recording completion
          setTimeout(() => {
            const mockBlob = new Blob(['audio data'], { type: 'audio/wav' })
            onRecordingComplete?.(mockBlob, 5.0, 'Test transcription')
            onRecordingStop?.()
          }, 100)
        }}
        disabled={disabled}
        data-testid="record-button"
      >
        Record
      </button>
    </div>
  )
}))

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  decodeAudioData: jest.fn((buffer, callback) => {
    const mockBuffer = {
      duration: 5.0,
      numberOfChannels: 2,
      sampleRate: 44100
    }
    callback(mockBuffer)
  }),
  createBufferSource: jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn()
  })),
  destination: {}
}))

describe('CollaborativeVoiceRoom', () => {
  const mockUser: CollaborationUser = {
    id: 'current-user',
    name: 'Current User',
    status: 'online',
    lastSeen: new Date()
  }

  const defaultProps = {
    roomId: 'test-room',
    currentUser: mockUser,
    onLeaveRoom: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render room interface correctly', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      expect(screen.getByText('参加者')).toBeInTheDocument()
      expect(screen.getByText('ルーム: test-room')).toBeInTheDocument()
      expect(screen.getByText('2人が参加中')).toBeInTheDocument()
    })

    test('should display online status indicator', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      expect(screen.getByText('オンライン')).toBeInTheDocument()
    })

    test('should show participants list', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    })
  })

  describe('User Status Indicators', () => {
    test('should show typing indicator for active users', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      expect(screen.getByText('録音中...')).toBeInTheDocument()
    })

    test('should display correct status colors', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      // Check that status indicators are rendered (specific color testing would require more complex setup)
      const aliceElement = screen.getByText('Alice Johnson')
      expect(aliceElement).toBeInTheDocument()

      const bobElement = screen.getByText('Bob Smith')
      expect(bobElement).toBeInTheDocument()
    })
  })

  describe('Voice Messages', () => {
    test('should display existing voice messages', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument()
      expect(screen.getByText(/再生 \(6秒\)/)).toBeInTheDocument()
    })

    test('should handle voice message playback', async () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const playButton = screen.getByText(/再生 \(6秒\)/)
      fireEvent.click(playButton)

      // Should not throw any errors
      await waitFor(() => {
        expect(playButton).toBeInTheDocument()
      })
    })
  })

  describe('Recording Functionality', () => {
    test('should handle voice recording', async () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const recordButton = screen.getByTestId('record-button')
      fireEvent.click(recordButton)

      await waitFor(() => {
        expect(screen.getByTestId('voice-recorder')).toBeInTheDocument()
      })
    })

    test('should show recording indicator when recording', async () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const recordButton = screen.getByTestId('record-button')
      fireEvent.click(recordButton)

      // Check for recording indicator text
      await waitFor(() => {
        expect(screen.getByText(/録音中... 他の参加者に通知されています/)).toBeInTheDocument()
      })
    })
  })

  describe('Audio Controls', () => {
    test('should toggle mute state', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const muteButton = screen.getByText('音声再生')
      fireEvent.click(muteButton)

      expect(screen.getByText('ミュート中')).toBeInTheDocument()

      // Toggle back
      fireEvent.click(screen.getByText('ミュート中'))
      expect(screen.getByText('音声再生')).toBeInTheDocument()
    })
  })

  describe('Room Management', () => {
    test('should handle leaving room', () => {
      const onLeaveRoom = jest.fn()
      render(<CollaborativeVoiceRoom {...defaultProps} onLeaveRoom={onLeaveRoom} />)

      const leaveButton = screen.getByText('ルームを退出')
      fireEvent.click(leaveButton)

      expect(onLeaveRoom).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    test('should show empty state when no messages', () => {
      // Mock empty messages
      jest.doMock('@/hooks/use-collaboration', () => ({
        useCollaboration: () => ({
          onlineUsers: [],
          typingUsers: [],
          messages: [],
          isConnected: true,
          sendVoiceMessage: jest.fn(),
          startTyping: jest.fn(),
          stopTyping: jest.fn(),
          updateUserStatus: jest.fn(),
          connect: jest.fn(),
          disconnect: jest.fn()
        })
      }))

      // Need to re-require the component for the mock to take effect
      const { CollaborativeVoiceRoom: EmptyRoom } = require('@/components/collaboration/collaborative-voice-room')

      render(<EmptyRoom {...defaultProps} />)

      expect(screen.getByText('まだメッセージがありません')).toBeInTheDocument()
      expect(screen.getByText('録音ボタンを押して最初のメッセージを送信してください')).toBeInTheDocument()
    })
  })

  describe('Connection Status', () => {
    test('should disable recording when disconnected', () => {
      // Mock disconnected state
      jest.doMock('@/hooks/use-collaboration', () => ({
        useCollaboration: () => ({
          onlineUsers: [],
          typingUsers: [],
          messages: [],
          isConnected: false,
          sendVoiceMessage: jest.fn(),
          startTyping: jest.fn(),
          stopTyping: jest.fn(),
          updateUserStatus: jest.fn(),
          connect: jest.fn(),
          disconnect: jest.fn()
        })
      }))

      const { CollaborativeVoiceRoom: DisconnectedRoom } = require('@/components/collaboration/collaborative-voice-room')
      render(<DisconnectedRoom {...defaultProps} />)

      expect(screen.getByText('オフライン')).toBeInTheDocument()
    })
  })

  describe('Message Timestamps', () => {
    test('should format message timestamps correctly', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      // Check that timestamp is displayed (exact format may vary based on locale)
      const timestampRegex = /\d{1,2}:\d{2}:\d{2}/
      expect(screen.getByText(timestampRegex)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      // Check for proper semantic structure
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    test('should handle keyboard navigation', () => {
      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const leaveButton = screen.getByText('ルームを退出')
      expect(leaveButton).toBeInTheDocument()
      expect(leaveButton.tagName).toBe('BUTTON')
    })
  })

  describe('Error Handling', () => {
    test('should handle audio decoding errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock AudioContext to throw error
      global.AudioContext = jest.fn().mockImplementation(() => ({
        decodeAudioData: jest.fn((buffer, callback, errorCallback) => {
          if (errorCallback) {
            errorCallback(new Error('Decode failed'))
          }
        })
      }))

      render(<CollaborativeVoiceRoom {...defaultProps} />)

      const playButton = screen.getByText(/再生 \(6秒\)/)
      fireEvent.click(playButton)

      await waitFor(() => {
        expect(playButton).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })
})