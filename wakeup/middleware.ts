import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";
import {
  getClientIP,
  hashIP,
  BruteForceProtection,
  setSecurityHeaders,
  AuditLogger,
  CSRFProtection
} from './lib/security/security-middleware'

// Rate limiting store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Security configuration
const RATE_LIMITS = {
  '/api/auth/': { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  '/api/': { requests: 100, window: 15 * 60 * 1000 }, // 100 requests per 15 minutes
  'default': { requests: 200, window: 15 * 60 * 1000 } // 200 requests per 15 minutes
}

/**
 * Rate limiting implementation
 */
function checkRateLimit(key: string, limit: { requests: number; window: number }): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // Reset or create new record
    const newRecord = {
      count: 1,
      resetTime: now + limit.window
    }
    rateLimitStore.set(key, newRecord)

    return {
      allowed: true,
      remaining: limit.requests - 1,
      resetTime: newRecord.resetTime
    }
  }

  if (record.count >= limit.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    }
  }

  record.count += 1
  rateLimitStore.set(key, record)

  return {
    allowed: true,
    remaining: limit.requests - record.count,
    resetTime: record.resetTime
  }
}

/**
 * Get rate limit configuration for path
 */
function getRateLimit(pathname: string): { requests: number; window: number } {
  for (const [path, limit] of Object.entries(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return limit
    }
  }
  return RATE_LIMITS.default
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip security middleware for static assets and internal Next.js routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.webp')
  ) {
    // Apply basic Supabase session handling for static routes
    return await updateSession(request);
  }

  try {
    // Get Supabase session response first
    const response = await updateSession(request);

    // Apply security headers
    setSecurityHeaders(response);

    const clientIP = getClientIP(request)
    const hashedIP = hashIP(clientIP)

    // Check brute force protection for auth endpoints
    if (pathname.startsWith('/api/auth/')) {
      const identifier = `auth_${hashedIP}`

      if (BruteForceProtection.isBlocked(identifier)) {
        const timeUntilReset = BruteForceProtection.getTimeUntilReset(identifier)

        await AuditLogger.logSecurityEvent(
          'brute_force_blocked',
          { path: pathname, timeUntilReset },
          request,
          'high'
        )

        const blockedResponse = new NextResponse(
          JSON.stringify({
            error: 'Too many failed attempts',
            retryAfter: Math.ceil(timeUntilReset / 1000)
          }),
          { status: 429 }
        )

        blockedResponse.headers.set('Retry-After', Math.ceil(timeUntilReset / 1000).toString())
        setSecurityHeaders(blockedResponse)
        return blockedResponse
      }
    }

    // Rate limiting
    const rateLimit = getRateLimit(pathname)
    const rateLimitKey = `rate_${hashedIP}_${pathname.startsWith('/api/auth/') ? 'auth' : 'general'}`
    const rateLimitResult = checkRateLimit(rateLimitKey, rateLimit)

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimit.requests.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())

    if (!rateLimitResult.allowed) {
      await AuditLogger.logSecurityEvent(
        'rate_limit_exceeded',
        { path: pathname, limit: rateLimit.requests },
        request,
        'medium'
      )

      const rateLimitResponse = new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          limit: rateLimit.requests,
          window: rateLimit.window / 1000,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }),
        { status: 429 }
      )

      rateLimitResponse.headers.set('Retry-After',
        Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString())
      setSecurityHeaders(rateLimitResponse)
      return rateLimitResponse
    }

    // CSRF protection for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) &&
        pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/auth/login')) {

      const sessionToken = request.cookies.get('session-token')?.value
      const csrfToken = request.headers.get('X-CSRF-Token') ||
                       request.headers.get('x-csrf-token')

      if (sessionToken && !csrfToken) {
        await AuditLogger.logSecurityEvent(
          'csrf_token_missing',
          { path: pathname, method: request.method },
          request,
          'medium'
        )

        const csrfResponse = new NextResponse(
          JSON.stringify({ error: 'CSRF token required' }),
          { status: 403 }
        )
        setSecurityHeaders(csrfResponse)
        return csrfResponse
      }

      if (sessionToken && csrfToken &&
          !CSRFProtection.validateToken(sessionToken, csrfToken)) {

        await AuditLogger.logSecurityEvent(
          'csrf_token_invalid',
          { path: pathname, method: request.method },
          request,
          'high'
        )

        const invalidCsrfResponse = new NextResponse(
          JSON.stringify({ error: 'Invalid CSRF token' }),
          { status: 403 }
        )
        setSecurityHeaders(invalidCsrfResponse)
        return invalidCsrfResponse
      }
    }

    // Security headers for API responses
    if (pathname.startsWith('/api/')) {
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('Cache-Control', 'no-store')
    }

    // Log suspicious activities
    await logSuspiciousActivity(request, pathname, clientIP)

    return response

  } catch (error) {
    console.error('Middleware error:', error)

    // Log security error
    await AuditLogger.logSecurityEvent(
      'middleware_error',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      request,
      'high'
    )

    // Return safe response on error
    const errorResponse = new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
    setSecurityHeaders(errorResponse)
    return errorResponse
  }
}

/**
 * Log suspicious activities
 */
async function logSuspiciousActivity(
  request: NextRequest,
  pathname: string,
  _clientIP: string
): Promise<void> {
  const userAgent = request.headers.get('user-agent') || ''

  // Detect common attack patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /eval\(/i,  // Code injection
    /system\(/i,  // Command injection
    /\${.*}/,  // Template injection
  ]

  const hasSuspiciousPattern = suspiciousPatterns.some(pattern =>
    pattern.test(pathname) ||
    pattern.test(request.nextUrl.search) ||
    pattern.test(userAgent)
  )

  if (hasSuspiciousPattern) {
    await AuditLogger.logSecurityEvent(
      'suspicious_request_pattern',
      {
        path: pathname,
        query: request.nextUrl.search,
        userAgent: userAgent.substring(0, 200) // Truncate long user agents
      },
      request,
      'high'
    )
  }

  // Detect automated attacks
  const isAutomatedRequest =
    !userAgent ||
    userAgent.includes('bot') ||
    userAgent.includes('crawler') ||
    userAgent.includes('scan')

  if (isAutomatedRequest && pathname.startsWith('/api/')) {
    await AuditLogger.logSecurityEvent(
      'automated_api_access',
      { userAgent },
      request,
      'medium'
    )
  }

  // Detect unusual request headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-host', 'host']
  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header)
    if (value && !value.includes(process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost')) {
      await AuditLogger.logSecurityEvent(
        'suspicious_host_header',
        { header, value },
        request,
        'medium'
      )
    }
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
