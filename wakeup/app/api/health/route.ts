import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 基本的なヘルスチェック
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      features: {
        supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        push_notifications: true,
        offline_support: true,
      }
    }

    return NextResponse.json(healthCheck, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

// HEAD request support for load balancers
export async function HEAD() {
  return new Response(null, { status: 200 })
}