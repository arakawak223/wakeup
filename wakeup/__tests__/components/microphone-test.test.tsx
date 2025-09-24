import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MicrophoneTest } from '@/components/audio/microphone-test'

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.navigator.mediaDevices.getUserMedia = mockGetUserMedia
})

describe('MicrophoneTest', () => {
  it('renders microphone test component', () => {
    render(<MicrophoneTest />)

    expect(screen.getByText('🎤 マイクテスト')).toBeInTheDocument()
    expect(screen.getByText('テスト開始')).toBeInTheDocument()
    expect(screen.getByText('マイクの動作確認を行います。「テスト開始」を押して5秒間話してください。')).toBeInTheDocument()
  })

  it('starts microphone test when button is clicked', async () => {
    const user = userEvent.setup()
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
    })

    render(<MicrophoneTest />)

    const startButton = screen.getByText('テスト開始')
    await user.click(startButton)

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    await waitFor(() => {
      expect(screen.getByText('テスト実行中...')).toBeInTheDocument()
    })
  })

  it('shows error when microphone access is denied', async () => {
    const user = userEvent.setup()
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

    render(<MicrophoneTest />)

    const startButton = screen.getByText('テスト開始')
    await user.click(startButton)

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })
  })

  it('calls onTestComplete callback when test finishes', async () => {
    jest.setTimeout(15000)
    const mockOnTestComplete = jest.fn()
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
    })

    // Mock AudioContext and related APIs
    const mockAnalyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: jest.fn()
    }

    const mockAudioContext = {
      createAnalyser: jest.fn(() => mockAnalyser),
      createMediaStreamSource: jest.fn(() => ({
        connect: jest.fn()
      }))
    }

    global.AudioContext = jest.fn(() => mockAudioContext) as any

    render(<MicrophoneTest onTestComplete={mockOnTestComplete} />)

    const user = userEvent.setup()
    const startButton = screen.getByText('テスト開始')
    await user.click(startButton)

    // Wait for test to complete with longer timeout
    await waitFor(() => {
      expect(mockOnTestComplete).toHaveBeenCalled()
    }, { timeout: 10000 })
  })

  it('cleans up resources properly', () => {
    const { unmount } = render(<MicrophoneTest />)

    // Should not throw any errors when unmounting
    expect(() => unmount()).not.toThrow()
  })
})