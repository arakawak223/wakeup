import { useCallback, useRef } from 'react'

/**
 * 依存関係の変更を最小限に抑えるための最適化されたuseCallback
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[]
): T {
  const callbackRef = useRef(callback)
  const depsRef = useRef(deps)

  // 依存関係が変更された場合のみコールバックを更新
  if (!areEqual(deps, depsRef.current)) {
    callbackRef.current = callback
    depsRef.current = deps
  }

  return useCallback(callbackRef.current, deps) as T
}

/**
 * 配列の浅い比較
 */
function areEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * デバウンス機能付きのコールバック
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: any[]
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    }) as T,
    [callback, delay, ...deps]
  )
}