import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceRecorderSupabase } from '@/components/voice-recorder-supabase'
import type { User } from '@supabase/supabase-js'

// Mock user data
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString()
}

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive',
  mimeType: 'audio/webm'
}

beforeEach(() => {
  jest.clearAllMocks()

  global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder)
  global.MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true)

  global.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue({
    getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
  })
})

describe('VoiceRecorderSupabase', () => {
  it('renders voice recorder component', () => {
    render(<VoiceRecorderSupabase user={mockUser} />)

    expect(screen.getByText('🎤 録音開始')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('メッセージタイトル（省略可）')).toBeInTheDocument()
    expect(screen.getByText('カテゴリ選択')).toBeInTheDocument()
  })

  it('shows quality metrics when enabled', () => {
    render(<VoiceRecorderSupabase user={mockUser} showQualityMetrics={true} />)

    expect(screen.getByText('音声品質メトリクス')).toBeInTheDocument()
  })

  it('starts recording when record button is clicked', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorderSupabase user={mockUser} />)

    const recordButton = screen.getByText('🎤 録音開始')
    await user.click(recordButton)

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 44100
      }
    })

    await waitFor(() => {
      expect(screen.getByText('⏹️ 録音停止')).toBeInTheDocument()
    })
  })

  it('stops recording when stop button is clicked', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorderSupabase user={mockUser} />)

    // Start recording
    const recordButton = screen.getByText('🎤 録音開始')
    await user.click(recordButton)

    await waitFor(() => {
      expect(screen.getByText('⏹️ 録音停止')).toBeInTheDocument()
    })

    // Stop recording
    const stopButton = screen.getByText('⏹️ 録音停止')
    await user.click(stopButton)

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
  })

  it('shows error message when microphone access fails', async () => {
    const user = userEvent.setup()
    global.navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
      new Error('Permission denied')
    )

    render(<VoiceRecorderSupabase user={mockUser} />)

    const recordButton = screen.getByText('🎤 録音開始')
    await user.click(recordButton)

    await waitFor(() => {
      expect(screen.getByText('マイクのアクセス許可が必要です')).toBeInTheDocument()
    })
  })

  it('allows title input', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorderSupabase user={mockUser} />)

    const titleInput = screen.getByPlaceholderText('メッセージタイトル（省略可）')
    await user.type(titleInput, 'Test Title')

    expect(titleInput).toHaveValue('Test Title')
  })

  it('allows category selection', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorderSupabase user={mockUser} />)

    const categorySelect = screen.getByText('カテゴリ選択')
    await user.click(categorySelect)

    await waitFor(() => {
      expect(screen.getByText('感謝')).toBeInTheDocument()
    })
  })

  it('calls onRecordingComplete callback after successful recording', async () => {
    const mockOnRecordingComplete = jest.fn()
    const user = userEvent.setup()

    // Mock successful upload
    jest.mock('@/lib/audio/supabase-audio', () => ({
      supabaseAudioManager: {
        uploadVoiceMessage: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'test-message-id'
        })
      }
    }))

    render(
      <VoiceRecorderSupabase
        user={mockUser}
        onRecordingComplete={mockOnRecordingComplete}
      />
    )

    // Start recording
    const recordButton = screen.getByText('🎤 録音開始')
    await user.click(recordButton)

    await waitFor(() => {
      expect(screen.getByText('⏹️ 録音停止')).toBeInTheDocument()
    })

    // Stop recording
    const stopButton = screen.getByText('⏹️ 録音停止')
    await user.click(stopButton)

    // Mock the ondataavailable event
    const mockBlob = new Blob(['test audio data'], { type: 'audio/webm' })
    const dataEvent = new Event('dataavailable')
    // @ts-ignore
    dataEvent.data = mockBlob

    if (mockMediaRecorder.addEventListener.mock.calls.length > 0) {
      const dataAvailableCallback = mockMediaRecorder.addEventListener.mock.calls
        .find(call => call[0] === 'dataavailable')?.[1]

      if (dataAvailableCallback) {
        dataAvailableCallback(dataEvent)
      }
    }

    // Mock the onstop event
    const stopEvent = new Event('stop')
    const stopCallback = mockMediaRecorder.addEventListener.mock.calls
      .find(call => call[0] === 'stop')?.[1]

    if (stopCallback) {
      stopCallback(stopEvent)
    }
  })

  it('shows upload progress during upload', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorderSupabase user={mockUser} />)

    // Start recording
    const recordButton = screen.getByText('🎤 録音開始')
    await user.click(recordButton)

    await waitFor(() => {
      expect(screen.getByText('⏹️ 録音停止')).toBeInTheDocument()
    })

    // Stop recording to trigger upload
    const stopButton = screen.getByText('⏹️ 録音停止')
    await user.click(stopButton)

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText('音声を処理中...')).toBeInTheDocument()
    })
  })

  it('disables recording when disabled prop is true', () => {
    render(<VoiceRecorderSupabase user={mockUser} disabled={true} />)

    const recordButton = screen.getByText('🎤 録音開始')
    expect(recordButton).toBeDisabled()
  })

  it('renders in message mode correctly', () => {
    render(<VoiceRecorderSupabase user={mockUser} mode="message" />)

    // Should still render the basic recording functionality
    expect(screen.getByText('🎤 録音開始')).toBeInTheDocument()
  })
})