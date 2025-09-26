'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

// ローディングコンポーネント
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
)

const LoadingCard = () => (
  <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full" />
)

// 重いコンポーネントを遅延読み込み
export const LazySecurityDashboard = dynamic(
  () => import('@/components/security/security-dashboard').then(mod => ({ default: mod.SecurityDashboard })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
)

export const LazyPerformanceDashboard = dynamic(
  () => import('@/components/performance/performance-dashboard').then(mod => ({ default: mod.PerformanceDashboard })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
)

export const LazyCollaborativeVoiceRoom = dynamic(
  () => import('@/components/collaboration/collaborative-voice-room').then(mod => ({ default: mod.CollaborativeVoiceRoom })),
  {
    loading: () => <LoadingCard />,
    ssr: false
  }
)

export const LazyVoiceRecorderEnhanced = dynamic(
  () => import('@/components/voice-recorder-enhanced').then(mod => ({ default: mod.EnhancedVoiceRecorder })),
  {
    loading: () => <LoadingCard />,
    ssr: false
  }
)

export const LazyAudioVisualizer = dynamic(
  () => import('@/components/audio/audio-visualizer').then(mod => ({ default: mod.AudioVisualizer })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
)

export const LazyMicrophoneTest = dynamic(
  () => import('@/components/audio/microphone-test').then(mod => ({ default: mod.MicrophoneTest })),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
)

// Suspenseでラップしたコンポーネント
export const LazySecurityDashboardWithSuspense = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <LazySecurityDashboard />
  </Suspense>
)

export const LazyPerformanceDashboardWithSuspense = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <LazyPerformanceDashboard />
  </Suspense>
)

// コンポーネントプリローダー
export const preloadComponent = (componentName: string) => {
  switch (componentName) {
    case 'security':
      return LazySecurityDashboard.preload()
    case 'performance':
      return LazyPerformanceDashboard.preload()
    case 'collaboration':
      return LazyCollaborativeVoiceRoom.preload()
    case 'recorder':
      return LazyVoiceRecorderEnhanced.preload()
    case 'visualizer':
      return LazyAudioVisualizer.preload()
    case 'microphone':
      return LazyMicrophoneTest.preload()
    default:
      console.warn(`Unknown component: ${componentName}`)
  }
}