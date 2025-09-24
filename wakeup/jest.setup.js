import '@testing-library/jest-dom'

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn(),
    connect: jest.fn(),
  }),
  createMediaStreamSource: jest.fn().mockReturnValue({
    connect: jest.fn(),
  }),
  close: jest.fn(),
  state: 'running',
}))

global.webkitAudioContext = global.AudioContext

// Mock MediaDevices API
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: jest.fn().mockReturnValue([{
      stop: jest.fn(),
    }]),
  }),
}

// Mock MediaRecorder API
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: jest.fn(),
  onstop: jest.fn(),
  onerror: jest.fn(),
  state: 'inactive',
  mimeType: 'audio/webm',
}))

global.MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true)

// Mock Speech Recognition API
global.SpeechRecognition = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onresult: jest.fn(),
  onerror: jest.fn(),
  onend: jest.fn(),
  onstart: jest.fn(),
  continuous: true,
  interimResults: true,
  lang: 'ja-JP',
  maxAlternatives: 1,
}))

global.webkitSpeechRecognition = global.SpeechRecognition

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
})

// Mock fetch
global.fetch = jest.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}