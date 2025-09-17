'use client'

import { useState, useRef, useEffect } from 'react'
import Image, { ImageProps } from 'next/image'

interface LazyImageProps extends Omit<ImageProps, 'onLoad'> {
  fallback?: string
  className?: string
}

export function LazyImage({
  src,
  alt,
  fallback = '/placeholder.png',
  className = '',
  ...props
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoading(false)
    setError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setError(true)
  }

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isInView && (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          )}
          <Image
            src={error ? fallback : src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            {...props}
          />
        </>
      )}
    </div>
  )
}