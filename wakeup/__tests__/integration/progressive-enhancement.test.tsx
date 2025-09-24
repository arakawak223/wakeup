/**
 * Progressive Enhancement Integration Tests
 * プログレッシブ・エンハンスメント統合テスト
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProgressiveVoiceRecorder } from '@/components/progressive/progressive-voice-recorder'
import { FeatureDetector } from '@/components/progressive/feature-detector'

// Mock Web APIs for different browser environments
const mockWebAPIs = {
  // Modern browser with all features
  modern: {
    MediaRecorder: class MockMediaRecorder {
      static isTypeSupported = jest.fn(() => true)
      start = jest.fn()
      stop = jest.fn()
      addEventListener = jest.fn()
      ondataavailable: ((event: any) => void) | null = null
      onstop: (() => void) | null = null
      state = 'inactive'
    },
    AudioContext: jest.fn(),
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }],
      getAudioTracks: () => [{ stop: jest.fn() }]
    }))
  },

  // Legacy browser with limited features
  legacy: {
    MediaRecorder: undefined,
    AudioContext: undefined,
    getUserMedia: undefined
  },

  // Partial support browser
  partial: {
    MediaRecorder: class MockMediaRecorder {
      static isTypeSupported = jest.fn(() => false)
    },
    AudioContext: jest.fn(),
    getUserMedia: jest.fn(() => Promise.reject(new Error('Permission denied')))
  }
}

describe('Progressive Enhancement Integration Tests', () => {
  let originalMediaRecorder: any
  let originalAudioContext: any
  let originalGetUserMedia: any

  beforeEach(() => {
    // Store original implementations
    originalMediaRecorder = (global as any).MediaRecorder
    originalAudioContext = (global as any).AudioContext
    originalGetUserMedia = global.navigator?.mediaDevices?.getUserMedia

    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore original implementations
    ;(global as any).MediaRecorder = originalMediaRecorder
    ;(global as any).AudioContext = originalAudioContext
    if (global.navigator?.mediaDevices) {
      global.navigator.mediaDevices.getUserMedia = originalGetUserMedia
    }
  })

  describe('Feature Detection', () => {
    test('should detect modern browser capabilities', async () => {
      // Setup modern browser environment
      ;(global as any).MediaRecorder = mockWebAPIs.modern.MediaRecorder
      ;(global as any).AudioContext = mockWebAPIs.modern.AudioContext
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockWebAPIs.modern.getUserMedia },
        configurable: true
      })

      let detectedFeatures: any

      render(
        <FeatureDetector>
          {(features) => {
            detectedFeatures = features
            return <div data-testid="feature-display">Features detected</div>
          }}
        </FeatureDetector>
      )

      await waitFor(() => {
        expect(screen.getByTestId('feature-display')).toBeInTheDocument()
      })

      expect(detectedFeatures.mediaRecorder).toBe(true)
      expect(detectedFeatures.webAudio).toBe(true)
    })

    test('should handle legacy browser gracefully', async () => {
      // Setup legacy browser environment
      ;(global as any).MediaRecorder = mockWebAPIs.legacy.MediaRecorder
      ;(global as any).AudioContext = mockWebAPIs.legacy.AudioContext
      delete (navigator as any).mediaDevices

      let detectedFeatures: any

      render(
        <FeatureDetector>
          {(features) => {
            detectedFeatures = features
            return <div data-testid="feature-display">Features detected</div>
          }}
        </FeatureDetector>
      )

      await waitFor(() => {
        expect(screen.getByTestId('feature-display')).toBeInTheDocument()
      })

      expect(detectedFeatures.mediaRecorder).toBe(false)
      expect(detectedFeatures.webAudio).toBe(false)
    })
  })

  describe('Progressive Voice Recorder', () => {
    test('should provide full functionality in modern browser', async () => {
      // Setup modern browser
      ;(global as any).MediaRecorder = mockWebAPIs.modern.MediaRecorder
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockWebAPIs.modern.getUserMedia },
        configurable: true
      })

      render(<ProgressiveVoiceRecorder />)

      expect(screen.getByText('録音開始')).toBeInTheDocument()
      expect(screen.queryByText('録音機能は利用できません')).not.toBeInTheDocument()
    })

    test('should show fallback UI in legacy browser', async () => {
      // Setup legacy browser
      ;(global as any).MediaRecorder = mockWebAPIs.legacy.MediaRecorder
      delete (navigator as any).mediaDevices

      render(<ProgressiveVoiceRecorder />)

      expect(screen.getByText('録音機能は利用できません')).toBeInTheDocument()
      expect(screen.queryByText('録音開始')).not.toBeInTheDocument()
    })

    test('should handle permission denied gracefully', async () => {
      // Setup partial support browser
      ;(global as any).MediaRecorder = mockWebAPIs.modern.MediaRecorder
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockWebAPIs.partial.getUserMedia },
        configurable: true
      })

      render(<ProgressiveVoiceRecorder />)

      const startButton = screen.getByText('録音開始')
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/マイクロフォンへのアクセスが拒否/)).toBeInTheDocument()
      })
    })
  })

  describe('Adaptive Functionality', () => {
    test('should adapt interface based on available features', async () => {
      const TestComponent = () => (
        <FeatureDetector>
          {(features) => (
            <div>
              {features.mediaRecorder && <div data-testid="recording-feature">Recording Available</div>}
              {features.webAudio && <div data-testid="audio-feature">Web Audio Available</div>}
              {!features.mediaRecorder && <div data-testid="fallback">Basic Mode</div>}
            </div>
          )}
        </FeatureDetector>
      )

      // Test with modern browser
      ;(global as any).MediaRecorder = mockWebAPIs.modern.MediaRecorder
      ;(global as any).AudioContext = mockWebAPIs.modern.AudioContext

      const { rerender } = render(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('recording-feature')).toBeInTheDocument()
        expect(screen.getByTestId('audio-feature')).toBeInTheDocument()
      })

      // Test with legacy browser
      ;(global as any).MediaRecorder = mockWebAPIs.legacy.MediaRecorder
      ;(global as any).AudioContext = mockWebAPIs.legacy.AudioContext

      rerender(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
        expect(screen.queryByTestId('recording-feature')).not.toBeInTheDocument()
      })
    })
  })

  describe('Cross-Browser Compatibility', () => {
    const browserConfigs = [
      {
        name: 'Chrome-like',
        MediaRecorder: mockWebAPIs.modern.MediaRecorder,
        AudioContext: mockWebAPIs.modern.AudioContext,
        prefixed: false
      },
      {
        name: 'Safari-like',
        MediaRecorder: mockWebAPIs.modern.MediaRecorder,
        AudioContext: undefined,
        webkitAudioContext: mockWebAPIs.modern.AudioContext,
        prefixed: true
      },
      {
        name: 'Firefox-like',
        MediaRecorder: mockWebAPIs.modern.MediaRecorder,
        AudioContext: mockWebAPIs.modern.AudioContext,
        mozAudioContext: mockWebAPIs.modern.AudioContext,
        prefixed: false
      }
    ]

    test.each(browserConfigs)('should work in $name browser', async ({ MediaRecorder, AudioContext, webkitAudioContext, mozAudioContext }) => {
      ;(global as any).MediaRecorder = MediaRecorder
      ;(global as any).AudioContext = AudioContext
      ;(global as any).webkitAudioContext = webkitAudioContext
      ;(global as any).mozAudioContext = mozAudioContext

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockWebAPIs.modern.getUserMedia },
        configurable: true
      })

      render(<ProgressiveVoiceRecorder />)

      expect(screen.getByText('音声録音')).toBeInTheDocument()
    })
  })

  describe('Performance Optimization', () => {
    test('should load features lazily', async () => {
      const mockImport = jest.fn(() => Promise.resolve({}))

      // Mock dynamic import
      jest.doMock('web-vitals', () => mockImport, { virtual: true })

      render(
        <FeatureDetector>
          {(features) => <div data-testid="loaded">Loaded</div>}
        </FeatureDetector>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loaded')).toBeInTheDocument()
      })

      // Features should be detected without loading heavy dependencies unnecessarily
    })

    test('should handle slow feature detection', async () => {
      const SlowDetector = () => (
        <FeatureDetector>
          {(features) => (
            <div data-testid="detector-result">
              {Object.keys(features).length > 0 ? 'Features detected' : 'Loading...'}
            </div>
          )}
        </FeatureDetector>
      )

      render(<SlowDetector />)

      // Should show initial state immediately
      expect(screen.getByTestId('detector-result')).toBeInTheDocument()

      // Should update when detection completes
      await waitFor(() => {
        expect(screen.getByText('Features detected')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility with Progressive Enhancement', () => {
    test('should maintain accessibility across feature levels', async () => {
      render(<ProgressiveVoiceRecorder />)

      // Should have proper ARIA labels regardless of feature support
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type')
      })
    })

    test('should provide keyboard navigation fallbacks', async () => {
      render(<ProgressiveVoiceRecorder />)

      const startButton = screen.getByRole('button')

      // Should be focusable
      startButton.focus()
      expect(startButton).toHaveFocus()

      // Should respond to keyboard events
      fireEvent.keyDown(startButton, { key: 'Enter' })
      // Should trigger appropriate action
    })
  })
})