'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { SpeechToTextService, type SpeechRecognitionResult } from '@/lib/accessibility/speech-to-text'
import { TextToSpeechService } from '@/lib/accessibility/text-to-speech'
import { keyboardNavigationService, type NavigationElement } from '@/lib/accessibility/keyboard-navigation'

interface AccessibilityContextValue {
  // Speech-to-Text
  speechToText: SpeechToTextService | null
  isListening: boolean
  startListening: (onResult: (result: SpeechRecognitionResult) => void) => void
  stopListening: () => void
  speechToTextSupported: boolean

  // Text-to-Speech
  textToSpeech: TextToSpeechService | null
  speak: (text: string) => Promise<void>
  speakNavigation: (action: string, destination?: string) => void
  stopSpeaking: () => void
  isSpeaking: boolean
  textToSpeechSupported: boolean

  // Keyboard Navigation
  keyboardNavigationActive: boolean
  toggleKeyboardNavigation: () => void
  registerNavigationElements: (elements: NavigationElement[]) => void

  // Settings
  accessibilityEnabled: boolean
  toggleAccessibility: () => void
  speechEnabled: boolean
  setSpeechEnabled: (enabled: boolean) => void
  keyboardNavigationEnabled: boolean
  setKeyboardNavigationEnabled: (enabled: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

interface AccessibilityProviderProps {
  children: ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  // Services
  const [speechToText, setSpeechToText] = useState<SpeechToTextService | null>(null)
  const [textToSpeech, setTextToSpeech] = useState<TextToSpeechService | null>(null)

  // States
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [keyboardNavigationActive, setKeyboardNavigationActive] = useState(false)

  // Settings
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const [keyboardNavigationEnabled, setKeyboardNavigationEnabled] = useState(false)

  // Support flags (only check on client side)
  const [speechToTextSupported, setSpeechToTextSupported] = useState(false)
  const [textToSpeechSupported, setTextToSpeechSupported] = useState(false)

  // Check support flags on client side
  useEffect(() => {
    setSpeechToTextSupported(SpeechToTextService.isSupported())
    setTextToSpeechSupported(TextToSpeechService.isSupported())
  }, [])

  // Initialize services
  useEffect(() => {
    if (speechToTextSupported) {
      const sttService = new SpeechToTextService({
        language: 'ja-JP',
        continuous: false,
        interimResults: true
      })
      setSpeechToText(sttService)
    }

    if (textToSpeechSupported) {
      const ttsService = new TextToSpeechService({
        language: 'ja-JP',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8
      })
      setTextToSpeech(ttsService)

      // Speaking状態の監視
      const checkSpeaking = setInterval(() => {
        setIsSpeaking(ttsService.isSpeaking())
      }, 100)

      return () => clearInterval(checkSpeaking)
    }
  }, [speechToTextSupported, textToSpeechSupported])

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedSettings = localStorage.getItem('accessibility-settings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        setAccessibilityEnabled(settings.enabled || false)
        setSpeechEnabled(settings.speechEnabled !== false)
        setKeyboardNavigationEnabled(settings.keyboardNavigationEnabled || false)
      } catch (error) {
        console.error('Failed to load accessibility settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const settings = {
      enabled: accessibilityEnabled,
      speechEnabled,
      keyboardNavigationEnabled
    }
    localStorage.setItem('accessibility-settings', JSON.stringify(settings))
  }, [accessibilityEnabled, speechEnabled, keyboardNavigationEnabled])

  // Keyboard navigation setup
  useEffect(() => {
    if (keyboardNavigationEnabled && accessibilityEnabled) {
      keyboardNavigationService.activate(
        (element, _index) => {
          if (speechEnabled && textToSpeech) {
            const label = element?.label || 'Unknown element'
            textToSpeech.speakNavigation('button_focused', label)
          }
        },
        (shortcut) => {
          console.log('Shortcut triggered:', shortcut.action)
        }
      )
      setKeyboardNavigationActive(true)
    } else {
      keyboardNavigationService.deactivate()
      setKeyboardNavigationActive(false)
    }

    return () => {
      keyboardNavigationService.deactivate()
    }
  }, [keyboardNavigationEnabled, accessibilityEnabled, speechEnabled, textToSpeech])

  // Speech-to-Text functions
  const startListening = (onResult: (result: SpeechRecognitionResult) => void) => {
    if (!speechToText || !accessibilityEnabled) return

    const success = speechToText.startListening(
      onResult,
      (error) => {
        console.error('Speech recognition error:', error)
        setIsListening(false)
        if (textToSpeech && speechEnabled) {
          textToSpeech.speakError('音声認識エラーが発生しました')
        }
      },
      () => {
        setIsListening(false)
      }
    )

    if (success) {
      setIsListening(true)
      if (textToSpeech && speechEnabled) {
        textToSpeech.speakNavigation('recording_started')
      }
    }
  }

  const stopListening = () => {
    if (speechToText) {
      speechToText.stopListening()
      setIsListening(false)
      if (textToSpeech && speechEnabled) {
        textToSpeech.speakNavigation('recording_stopped')
      }
    }
  }

  // Text-to-Speech functions
  const speak = async (text: string): Promise<void> => {
    if (!textToSpeech || !speechEnabled || !accessibilityEnabled) return
    return textToSpeech.speak(text)
  }

  const speakNavigation = (action: string, destination?: string) => {
    if (textToSpeech && speechEnabled && accessibilityEnabled) {
      textToSpeech.speakNavigation(action, destination)
    }
  }

  const stopSpeaking = () => {
    if (textToSpeech) {
      textToSpeech.stop()
    }
  }

  // Keyboard navigation functions
  const toggleKeyboardNavigation = () => {
    setKeyboardNavigationEnabled(!keyboardNavigationEnabled)
  }

  const registerNavigationElements = (elements: NavigationElement[]) => {
    keyboardNavigationService.registerNavigationElements(elements)
  }

  // Main accessibility toggle
  const toggleAccessibility = () => {
    const newState = !accessibilityEnabled
    setAccessibilityEnabled(newState)

    if (textToSpeech && speechEnabled) {
      if (newState) {
        textToSpeech.speak('アクセシビリティ機能を有効にしました')
      } else {
        textToSpeech.speak('アクセシビリティ機能を無効にしました')
      }
    }
  }

  const contextValue: AccessibilityContextValue = {
    // Speech-to-Text
    speechToText,
    isListening,
    startListening,
    stopListening,
    speechToTextSupported,

    // Text-to-Speech
    textToSpeech,
    speak,
    speakNavigation,
    stopSpeaking,
    isSpeaking,
    textToSpeechSupported,

    // Keyboard Navigation
    keyboardNavigationActive,
    toggleKeyboardNavigation,
    registerNavigationElements,

    // Settings
    accessibilityEnabled,
    toggleAccessibility,
    speechEnabled,
    setSpeechEnabled,
    keyboardNavigationEnabled,
    setKeyboardNavigationEnabled
  }

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}

// Accessibility controls component
export function AccessibilityControls() {
  const {
    accessibilityEnabled,
    toggleAccessibility,
    speechEnabled,
    setSpeechEnabled,
    keyboardNavigationEnabled,
    setKeyboardNavigationEnabled,
    speechToTextSupported,
    textToSpeechSupported
  } = useAccessibility()

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg z-50">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          ♿ アクセシビリティ
        </h3>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={accessibilityEnabled}
              onChange={toggleAccessibility}
              className="rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              アクセシビリティ機能を有効
            </span>
          </label>

          {accessibilityEnabled && (
            <>
              {textToSpeechSupported && (
                <label className="flex items-center gap-2 ml-4">
                  <input
                    type="checkbox"
                    checked={speechEnabled}
                    onChange={(e) => setSpeechEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    音声読み上げ
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2 ml-4">
                <input
                  type="checkbox"
                  checked={keyboardNavigationEnabled}
                  onChange={(e) => setKeyboardNavigationEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  キーボードナビゲーション
                </span>
              </label>
            </>
          )}
        </div>

        {accessibilityEnabled && (
          <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
            <div>Shift + ? : ショートカット一覧</div>
            <div>F1 : ヘルプ読み上げ</div>
            <div>F3 : 読み上げ停止</div>
          </div>
        )}

        <div className="text-xs text-gray-400 dark:text-gray-500">
          {!speechToTextSupported && 'Speech-to-Text: 未対応'}
          {!textToSpeechSupported && 'Text-to-Speech: 未対応'}
        </div>
      </div>
    </div>
  )
}