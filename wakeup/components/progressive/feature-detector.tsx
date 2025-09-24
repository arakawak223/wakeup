'use client'

import React, { useEffect, useState } from 'react'

interface FeatureSupport {
  mediaRecorder: boolean
  webAudio: boolean
  webRTC: boolean
  serviceWorker: boolean
  indexedDB: boolean
  notifications: boolean
  deviceOrientation: boolean
  vibration: boolean
}

interface FeatureDetectorProps {
  children: (features: FeatureSupport) => React.ReactNode
}

export const FeatureDetector: React.FC<FeatureDetectorProps> = ({ children }) => {
  const [features, setFeatures] = useState<FeatureSupport>({
    mediaRecorder: false,
    webAudio: false,
    webRTC: false,
    serviceWorker: false,
    indexedDB: false,
    notifications: false,
    deviceOrientation: false,
    vibration: false
  })

  useEffect(() => {
    const detectFeatures = () => {
      setFeatures({
        mediaRecorder: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm'),
        webAudio: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
        webRTC: typeof RTCPeerConnection !== 'undefined',
        serviceWorker: 'serviceWorker' in navigator,
        indexedDB: typeof indexedDB !== 'undefined',
        notifications: 'Notification' in window,
        deviceOrientation: 'DeviceOrientationEvent' in window,
        vibration: 'vibrate' in navigator
      })
    }

    detectFeatures()
  }, [])

  return <>{children(features)}</>
}

export const withFeatureDetection = <T extends object>(
  Component: React.ComponentType<T & { features: FeatureSupport }>
) => {
  return (props: T) => (
    <FeatureDetector>
      {(features) => <Component {...props} features={features} />}
    </FeatureDetector>
  )
}