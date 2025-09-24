import { ScreenReaderAnnouncer, AriaLabels, FocusManager } from '@/lib/accessibility/screen-reader'

// Mock DOM APIs
Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    contains: jest.fn(() => true),
    insertBefore: jest.fn()
  }
})

Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    id: '',
    setAttribute: jest.fn(),
    className: '',
    textContent: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
})

Object.defineProperty(document, 'activeElement', {
  value: {
    focus: jest.fn()
  },
  configurable: true
})

Object.defineProperty(document, 'querySelectorAll', {
  value: jest.fn(() => [])
})

describe('ScreenReaderAnnouncer', () => {
  let announcer: ScreenReaderAnnouncer

  beforeEach(() => {
    jest.clearAllMocks()
    announcer = ScreenReaderAnnouncer.getInstance()
  })

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = ScreenReaderAnnouncer.getInstance()
      const instance2 = ScreenReaderAnnouncer.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Basic Announcements', () => {
    test('should announce simple message', () => {
      expect(() => {
        announcer.announce('Test message')
      }).not.toThrow()
    })

    test('should announce with priority', () => {
      expect(() => {
        announcer.announce('Urgent message', 'assertive')
      }).not.toThrow()
    })
  })

  describe('Recording Announcements', () => {
    test('should announce recording start', () => {
      expect(() => {
        announcer.announceRecordingStart()
      }).not.toThrow()
    })

    test('should announce recording start with duration', () => {
      expect(() => {
        announcer.announceRecordingStart(30)
      }).not.toThrow()
    })

    test('should announce recording stop', () => {
      expect(() => {
        announcer.announceRecordingStop(5.5)
      }).not.toThrow()
    })

    test('should announce recording error', () => {
      expect(() => {
        announcer.announceRecordingError('Microphone access denied')
      }).not.toThrow()
    })
  })

  describe('Playback Announcements', () => {
    test('should announce playback start', () => {
      expect(() => {
        announcer.announcePlaybackStart(10.5)
      }).not.toThrow()
    })

    test('should announce playback end', () => {
      expect(() => {
        announcer.announcePlaybackEnd()
      }).not.toThrow()
    })
  })

  describe('Collaboration Announcements', () => {
    test('should announce user joined', () => {
      expect(() => {
        announcer.announceUserJoined('Alice')
      }).not.toThrow()
    })

    test('should announce user left', () => {
      expect(() => {
        announcer.announceUserLeft('Bob')
      }).not.toThrow()
    })

    test('should announce new message', () => {
      expect(() => {
        announcer.announceNewMessage('Charlie', 8.3)
      }).not.toThrow()
    })

    test('should announce typing start', () => {
      expect(() => {
        announcer.announceTypingStart('Dave')
      }).not.toThrow()
    })
  })

  describe('Connection Status Announcements', () => {
    test('should announce connection status - online', () => {
      expect(() => {
        announcer.announceConnectionStatus(true)
      }).not.toThrow()
    })

    test('should announce connection status - offline', () => {
      expect(() => {
        announcer.announceConnectionStatus(false)
      }).not.toThrow()
    })
  })
})

describe('AriaLabels', () => {
  describe('Button Labels', () => {
    test('should generate record button label - not recording', () => {
      const label = AriaLabels.recordButton(false)
      expect(label).toBe('音声録音を開始')
    })

    test('should generate record button label - recording', () => {
      const label = AriaLabels.recordButton(true)
      expect(label).toBe('録音を停止')
    })

    test('should generate play button label without duration', () => {
      const label = AriaLabels.playButton()
      expect(label).toBe('音声を再生')
    })

    test('should generate play button label with duration', () => {
      const label = AriaLabels.playButton(5.7)
      expect(label).toBe('音声を再生 (6秒)')
    })

    test('should generate pause button label', () => {
      const label = AriaLabels.pauseButton()
      expect(label).toBe('再生を一時停止')
    })

    test('should generate stop button label', () => {
      const label = AriaLabels.stopButton()
      expect(label).toBe('再生を停止')
    })
  })

  describe('Control Labels', () => {
    test('should generate mute button label - not muted', () => {
      const label = AriaLabels.muteButton(false)
      expect(label).toBe('ミュート')
    })

    test('should generate mute button label - muted', () => {
      const label = AriaLabels.muteButton(true)
      expect(label).toBe('ミュートを解除')
    })

    test('should generate volume slider label', () => {
      const label = AriaLabels.volumeSlider(0.75)
      expect(label).toBe('音量調整 (現在: 75%)')
    })

    test('should generate progress slider label', () => {
      const label = AriaLabels.progressSlider(3.2, 10.8)
      expect(label).toBe('再生位置 (3秒 / 11秒)')
    })
  })

  describe('User Interface Labels', () => {
    test('should generate user status label', () => {
      const label = AriaLabels.userStatus('Alice Johnson', 'online')
      expect(label).toBe('Alice Johnsonさん (online)')
    })

    test('should generate message item label', () => {
      const timestamp = new Date('2023-12-01T10:30:00')
      const label = AriaLabels.messageItem('Bob Smith', 7.5, timestamp)
      expect(label).toContain('Bob Smithさんからの音声メッセージ、8秒')
      expect(label).toContain('10:30:00')
    })
  })
})

describe('FocusManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset the focus stack
    ;(FocusManager as any).focusStack = []

    // Mock activeElement
    Object.defineProperty(document, 'activeElement', {
      value: { focus: jest.fn() },
      configurable: true
    })
  })

  describe('Focus Stack Management', () => {
    test('should save and restore focus', () => {
      const mockElement = { focus: jest.fn() }
      Object.defineProperty(document, 'activeElement', {
        value: mockElement,
        configurable: true
      })

      FocusManager.saveFocus()
      FocusManager.restoreFocus()

      expect(mockElement.focus).toHaveBeenCalled()
    })

    test('should handle empty focus stack', () => {
      expect(() => {
        FocusManager.restoreFocus()
      }).not.toThrow()
    })

    test('should not restore focus for removed elements', () => {
      const mockElement = { focus: jest.fn() }
      Object.defineProperty(document, 'activeElement', {
        value: mockElement,
        configurable: true
      })

      // Mock document.contains to return false
      Object.defineProperty(document, 'contains', {
        value: jest.fn(() => false)
      })

      FocusManager.saveFocus()
      FocusManager.restoreFocus()

      expect(mockElement.focus).not.toHaveBeenCalled()
    })
  })

  describe('Focus Trap', () => {
    test('should set up focus trap', () => {
      const mockContainer = {
        querySelectorAll: jest.fn(() => [
          { focus: jest.fn() },
          { focus: jest.fn() }
        ]),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }

      const cleanup = FocusManager.trapFocus(mockContainer as any)

      expect(mockContainer.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(typeof cleanup).toBe('function')

      if (cleanup) {
        cleanup()
        expect(mockContainer.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      }
    })

    test('should handle empty focusable elements', () => {
      const mockContainer = {
        querySelectorAll: jest.fn(() => []),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }

      const cleanup = FocusManager.trapFocus(mockContainer as any)

      expect(mockContainer.addEventListener).not.toHaveBeenCalled()
      expect(cleanup).toBeUndefined()
    })
  })
})