# Enterprise Deployment Guide
# エンタープライズ展開ガイド

## Overview / 概要

This guide provides comprehensive instructions for deploying the WakeUp voice messaging application in enterprise environments with high availability, security, and scalability requirements.

本ガイドでは、高可用性、セキュリティ、スケーラビリティの要件を満たすエンタープライズ環境でのWakeUp音声メッセージングアプリケーションの展開について包括的な手順を説明します。

## Architecture Overview / アーキテクチャ概要

### Core Components / コアコンポーネント

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Next.js App   │    │   Supabase      │
│   (Nginx/ALB)   │────│   (Multiple     │────│   (Database +   │
│                 │    │   Instances)    │    │   Auth + RT)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN           │    │   Redis Cache   │    │   File Storage  │
│   (Static       │    │   (Session +    │    │   (Voice Files) │
│   Assets)       │    │   Performance)  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Infrastructure Requirements / インフラ要件

- **Compute**: Minimum 3 application instances for high availability
- **Memory**: 4GB RAM per instance (8GB recommended)
- **CPU**: 4 vCPUs per instance (8 vCPUs recommended)
- **Storage**: SSD with minimum 100GB per instance
- **Network**: Low latency connection to database and file storage

## Production Environment Setup / プロダクション環境セットアップ

### 1. Environment Configuration / 環境設定

Create a production environment configuration file:

```bash
# .env.production
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Monitoring
NEXT_PUBLIC_ENABLE_MONITORING=true
MONITORING_ENDPOINT=https://monitoring.your-domain.com/api/events
MONITORING_API_KEY=your-monitoring-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# Redis Cache
REDIS_URL=redis://redis-host:6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Security
JWT_SECRET=your-jwt-secret-key-minimum-32-chars
ENCRYPTION_KEY=your-encryption-key-32-chars
SESSION_SECRET=your-session-secret-key

# File Storage
STORAGE_BUCKET=your-storage-bucket
STORAGE_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Email (Optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

### 2. Docker Production Build / Docker プロダクションビルド

#### Multi-stage Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Docker Compose for Production

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 4G
          cpus: '2'
        reservations:
          memory: 2G
          cpus: '1'

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### 3. Nginx Configuration / Nginx設定

```nginx
upstream app_upstream {
    least_conn;
    server app:3000 weight=1 max_fails=3 fail_timeout=30s;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json;

    # Static Assets
    location /_next/static/ {
        alias /app/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API Routes with Rate Limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Login Rate Limiting
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://app_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main Application
    location / {
        proxy_pass http://app_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 4. Health Check Endpoint / ヘルスチェックエンドポイント

```typescript
// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next'

type HealthResponse = {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: boolean
    redis: boolean
    storage: boolean
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    storage: await checkStorage()
  }

  const isHealthy = Object.values(checks).every(check => check)

  const response: HealthResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    checks
  }

  const statusCode = isHealthy ? 200 : 503
  res.status(statusCode).json(response)
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Add your database health check logic
    return true
  } catch {
    return false
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // Add your Redis health check logic
    return true
  } catch {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    // Add your storage health check logic
    return true
  } catch {
    return false
  }
}
```

## Monitoring and Observability / 監視と可観測性

### 1. Application Monitoring / アプリケーション監視

The integrated production monitoring system provides:

- **Performance Metrics**: Core Web Vitals, load times, memory usage
- **Error Tracking**: JavaScript errors, API failures, unhandled promises
- **User Analytics**: Session tracking, feature usage, conversion funnels
- **Security Events**: Authentication failures, suspicious activities

### 2. Infrastructure Monitoring / インフラ監視

Recommended monitoring stack:

```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

  node-exporter:
    image: prom/node-exporter
    ports:
      - "9100:9100"

volumes:
  prometheus_data:
  grafana_data:
```

### 3. Logging Configuration / ログ設定

```typescript
// lib/logging/production-logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'wakeup-app',
    version: process.env.APP_VERSION
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

export default logger
```

## Security Hardening / セキュリティ強化

### 1. Application Security / アプリケーションセキュリティ

- **Content Security Policy (CSP)**: Implemented in Nginx configuration
- **HTTPS Enforcement**: SSL/TLS with HTTP redirection
- **Rate Limiting**: API and authentication endpoint protection
- **Input Validation**: Server-side validation for all user inputs
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Protection**: React's built-in escaping + CSP headers

### 2. Infrastructure Security / インフラセキュリティ

- **Network Segmentation**: Separate subnets for app, database, and cache
- **Firewall Rules**: Restrict access to necessary ports only
- **Regular Updates**: Automated security patches for base images
- **Secrets Management**: Environment variables via secure secret stores
- **Access Control**: RBAC for deployment and management access

## Deployment Strategies / 展開戦略

### 1. Blue-Green Deployment / ブルーグリーン展開

```bash
#!/bin/bash
# deploy-blue-green.sh

CURRENT_ENV=$(curl -s http://your-domain.com/api/health | jq -r '.version')
NEW_ENV="blue"

if [ "$CURRENT_ENV" = "blue" ]; then
    NEW_ENV="green"
fi

echo "Deploying to $NEW_ENV environment..."

# Build and deploy to new environment
docker-compose -f docker-compose.$NEW_ENV.yml up -d --build

# Health check
sleep 30
if curl -f http://$NEW_ENV.your-domain.com/api/health; then
    echo "Health check passed, switching traffic..."
    # Update load balancer to point to new environment
    ./switch-traffic.sh $NEW_ENV
    echo "Deployment successful!"
else
    echo "Health check failed, rolling back..."
    docker-compose -f docker-compose.$NEW_ENV.yml down
    exit 1
fi
```

### 2. Rolling Updates / ローリングアップデート

```yaml
# kubernetes/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wakeup-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: wakeup-app
  template:
    metadata:
      labels:
        app: wakeup-app
    spec:
      containers:
      - name: app
        image: wakeup-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Performance Optimization / パフォーマンス最適化

### 1. Caching Strategy / キャッシュ戦略

```typescript
// lib/cache/redis-cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }
}
```

### 2. Database Optimization / データベース最適化

```sql
-- Database performance optimization
-- Add indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_voice_messages_user_id ON voice_messages(user_id);
CREATE INDEX CONCURRENTLY idx_voice_messages_created_at ON voice_messages(created_at);
CREATE INDEX CONCURRENTLY idx_voice_messages_status ON voice_messages(status);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_voice_messages_user_status
ON voice_messages(user_id, status, created_at);

-- Enable query plan caching
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
```

## Troubleshooting Guide / トラブルシューティングガイド

### Common Issues / よくある問題

1. **High Memory Usage / メモリ使用量が高い**
   - Monitor Node.js heap usage via `/api/health`
   - Check for memory leaks in audio processing
   - Implement proper cleanup of MediaRecorder instances

2. **Database Connection Issues / データベース接続の問題**
   - Verify connection pool settings
   - Check network connectivity to Supabase
   - Monitor connection count and timeout settings

3. **Audio Processing Failures / 音声処理の失敗**
   - Verify browser compatibility with MediaRecorder API
   - Check microphone permissions and HTTPS requirements
   - Monitor file size limits and processing timeouts

### Performance Monitoring / パフォーマンス監視

```bash
# Monitor application performance
docker stats wakeup_app_1
docker exec wakeup_app_1 ps aux
docker exec wakeup_app_1 free -h

# Check application logs
docker logs wakeup_app_1 --tail=100 -f

# Database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

## Maintenance Procedures / メンテナンス手順

### 1. Regular Backups / 定期バックアップ

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump $DATABASE_URL > backup_${DATE}.sql
aws s3 cp backup_${DATE}.sql s3://your-backup-bucket/db/

# File storage backup
aws s3 sync s3://your-storage-bucket s3://your-backup-bucket/files/${DATE}/
```

### 2. Security Updates / セキュリティアップデート

```bash
#!/bin/bash
# update-security.sh

# Update base images
docker pull node:18-alpine
docker pull nginx:alpine
docker pull redis:7-alpine

# Rebuild with latest patches
docker-compose build --no-cache
docker-compose up -d
```

This enterprise deployment guide provides the foundation for running the WakeUp application at scale with enterprise-grade reliability, security, and performance requirements.