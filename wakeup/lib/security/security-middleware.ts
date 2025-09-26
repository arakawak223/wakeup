/**
 * Advanced Security Middleware
 * 高度なセキュリティミドルウェア
 */

import { NextRequest, NextResponse } from 'next/server'
// Web Crypto API for Edge runtime compatibility

// Security configuration
const SECURITY_CONFIG = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  },
  slowDown: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 500, // add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // maximum delay of 20 seconds
  },
  bruteForce: {
    freeRetries: 5,
    minWait: 5 * 60 * 1000, // 5 minutes
    maxWait: 60 * 60 * 1000, // 1 hour
    lifetime: 24 * 60 * 60 * 1000, // 24 hours
  },
  session: {
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  }
}

// In-memory store for demo (use Redis in production)
const bruteForceStore = new Map<string, {
  count: number
  resetTime: number
  nextAttempt: number
}>()

const sessionStore = new Map<string, {
  userId: string
  createdAt: number
  lastActivity: number
  ipAddress: string
  userAgent: string
}>()

/**
 * Generate secure session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash IP address for privacy
 */
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + process.env.SECURITY_SALT || '')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get client IP address
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return '127.0.0.1'
}

/**
 * Brute force protection
 */
export class BruteForceProtection {
  static isBlocked(identifier: string): boolean {
    const record = bruteForceStore.get(identifier)

    if (!record) return false

    const now = Date.now()

    // Reset if lifetime expired
    if (now > record.resetTime) {
      bruteForceStore.delete(identifier)
      return false
    }

    // Check if still in timeout period
    return now < record.nextAttempt
  }

  static recordAttempt(identifier: string, success: boolean): void {
    const now = Date.now()
    const record = bruteForceStore.get(identifier) || {
      count: 0,
      resetTime: now + SECURITY_CONFIG.bruteForce.lifetime,
      nextAttempt: now
    }

    if (success) {
      // Reset on successful attempt
      bruteForceStore.delete(identifier)
      return
    }

    // Increment failure count
    record.count += 1

    if (record.count > SECURITY_CONFIG.bruteForce.freeRetries) {
      // Calculate exponential backoff
      const attempts = record.count - SECURITY_CONFIG.bruteForce.freeRetries
      const delay = Math.min(
        SECURITY_CONFIG.bruteForce.minWait * Math.pow(2, attempts - 1),
        SECURITY_CONFIG.bruteForce.maxWait
      )

      record.nextAttempt = now + delay
    }

    bruteForceStore.set(identifier, record)
  }

  static getTimeUntilReset(identifier: string): number {
    const record = bruteForceStore.get(identifier)
    if (!record) return 0

    return Math.max(0, record.nextAttempt - Date.now())
  }
}

/**
 * Session management
 */
export class SessionManager {
  static async create(userId: string, request: NextRequest): Promise<string> {
    const token = generateSessionToken()
    const now = Date.now()

    const hashedIP = await hashIP(getClientIP(request))
    sessionStore.set(token, {
      userId,
      createdAt: now,
      lastActivity: now,
      ipAddress: hashedIP,
      userAgent: request.headers.get('user-agent') || ''
    })

    return token
  }

  static async validate(token: string, request: NextRequest): Promise<{ valid: boolean; userId?: string }> {
    const session = sessionStore.get(token)

    if (!session) {
      return { valid: false }
    }

    const now = Date.now()

    // Check if session expired
    if (now - session.lastActivity > SECURITY_CONFIG.session.maxAge) {
      sessionStore.delete(token)
      return { valid: false }
    }

    // Validate IP address (optional strict check)
    const currentIP = await hashIP(getClientIP(request))
    if (process.env.STRICT_IP_VALIDATION === 'true' && session.ipAddress !== currentIP) {
      sessionStore.delete(token)
      return { valid: false }
    }

    // Update last activity
    session.lastActivity = now
    sessionStore.set(token, session)

    return { valid: true, userId: session.userId }
  }

  static destroy(token: string): void {
    sessionStore.delete(token)
  }

  static cleanup(): void {
    const now = Date.now()
    for (const [token, session] of sessionStore.entries()) {
      if (now - session.lastActivity > SECURITY_CONFIG.session.maxAge) {
        sessionStore.delete(token)
      }
    }
  }
}

/**
 * Content Security Policy configuration
 */
export const CSP_POLICY = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-eval'", // Required for Next.js development
    process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : '',
    'https://challenges.cloudflare.com',
    // GitHub Codespaces開発環境対応
    process.env.NODE_ENV === 'development' ? 'https://*.app.github.dev' : '',
  ].filter(Boolean),
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components and CSS-in-JS
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
  ],
  'font-src': [
    "'self'",
    'data:',
  ],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.MONITORING_ENDPOINT || '',
    // GitHub Codespaces開発環境対応 - より広範なパターン
    process.env.NODE_ENV === 'development' ? 'https://*.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'wss://*.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'https://*-3000.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'wss://*-3000.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'https://*-*-*-3000.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'wss://*-*-*-3000.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'https://*-*-*-*-*-3000.app.github.dev' : '',
    process.env.NODE_ENV === 'development' ? 'wss://*-*-*-*-*-3000.app.github.dev' : '',
  ].filter(Boolean),
  'media-src': [
    "'self'",
    'blob:',
    'data:',
  ],
  'frame-src': [
    "'none'"
  ],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
}

/**
 * Security headers middleware
 */
export function setSecurityHeaders(response: NextResponse): void {
  // Content Security Policy
  const cspHeader = Object.entries(CSP_POLICY)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')

  response.headers.set('Content-Security-Policy', cspHeader)

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=()')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload')
  }

  // Remove server information
  response.headers.set('Server', 'WakeUp')
  response.headers.delete('X-Powered-By')
}

/**
 * Input validation and sanitization
 */
export class InputValidator {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return ''

    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>'"&]/g, (match) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        }
        return entities[match] || match
      })
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  static isValidPassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return { valid: errors.length === 0, errors }
  }

  static sanitizeAudioFile(filename: string): { valid: boolean; sanitized: string } {
    const allowedExtensions = ['.wav', '.mp3', '.m4a', '.webm', '.ogg']
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')

    const extension = sanitized.substring(sanitized.lastIndexOf('.')).toLowerCase()
    const valid = allowedExtensions.includes(extension)

    return { valid, sanitized }
  }
}

/**
 * Audit logging
 */
export class AuditLogger {
  static async logSecurityEvent(
    event: string,
    details: Record<string, unknown>,
    request: NextRequest,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      severity,
      ip: await hashIP(getClientIP(request)),
      userAgent: request.headers.get('user-agent'),
      url: request.url,
      method: request.method,
      details,
      sessionId: request.cookies.get('session-token')?.value || null
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
      // await sendToLogService(logEntry)
      console.error('[SECURITY]', JSON.stringify(logEntry))
    } else {
      console.warn('[SECURITY]', logEntry)
    }

    // Store critical events for immediate attention
    if (severity === 'critical') {
      // await alertSecurityTeam(logEntry)
    }
  }

  static async logAuthEvent(
    event: 'login' | 'logout' | 'failed_login' | 'password_change',
    userId: string | null,
    request: NextRequest,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logSecurityEvent(`auth_${event}`, {
      userId,
      ...details
    }, request, event === 'failed_login' ? 'medium' : 'low')
  }
}

/**
 * CSRF Protection
 */
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>()

  static generateToken(sessionId: string): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    const expires = Date.now() + (60 * 60 * 1000) // 1 hour

    this.tokens.set(sessionId, { token, expires })
    return token
  }

  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId)

    if (!stored) return false

    if (Date.now() > stored.expires) {
      this.tokens.delete(sessionId)
      return false
    }

    return stored.token === token
  }

  static cleanup(): void {
    const now = Date.now()
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now > data.expires) {
        this.tokens.delete(sessionId)
      }
    }
  }
}

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    SessionManager.cleanup()
    CSRFProtection.cleanup()
  }, 5 * 60 * 1000) // Every 5 minutes
}

const securityMiddleware = {
  BruteForceProtection,
  SessionManager,
  InputValidator,
  AuditLogger,
  CSRFProtection,
  setSecurityHeaders,
  generateSessionToken,
  hashIP,
  getClientIP,
  SECURITY_CONFIG,
  CSP_POLICY
}

export default securityMiddleware