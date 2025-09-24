#!/bin/bash

# Production Deployment Script for Wakeup Voice Messaging App
# エンタープライズグレード音声メッセージアプリのプロダクション展開スクリプト

set -e

echo "🚀 Starting Wakeup App Production Deployment..."

# Check required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Supabase environment variables are required"
    exit 1
fi

# Create necessary directories
echo "📁 Creating deployment directories..."
mkdir -p nginx/ssl
mkdir -p data/uploads
mkdir -p logs

# Generate SSL certificates (if not provided)
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "🔐 Generating self-signed SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes \
        -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Wakeup/OU=IT/CN=localhost"
fi

# Build and deploy with Docker Compose
echo "🏗️ Building and starting containers..."
docker-compose -f docker-compose.production.yml down --remove-orphans
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🏥 Performing health checks..."
for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Application is healthy!"
        break
    else
        echo "⏳ Waiting for application... (attempt $i/10)"
        sleep 5
    fi
done

# Display deployment info
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Application Status:"
echo "   • Application URL: https://localhost"
echo "   • Health Check: http://localhost/health"
echo "   • Logs: docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "🔧 Management Commands:"
echo "   • Stop: docker-compose -f docker-compose.production.yml down"
echo "   • Update: ./scripts/deploy.sh"
echo "   • Logs: docker-compose -f docker-compose.production.yml logs -f wakeup-app"
echo ""
echo "🔐 Security Features Enabled:"
echo "   • End-to-End Encryption (RSA-4096 + AES-256)"
echo "   • HTTPS with SSL/TLS"
echo "   • Security Headers (CSP, HSTS, XSS Protection)"
echo "   • Rate Limiting"
echo "   • GDPR/CCPA Privacy Compliance"
echo ""
echo "⚡ Performance Features:"
echo "   • Service Worker Caching"
echo "   • Gzip Compression"
echo "   • Static Asset Optimization"
echo "   • Real-time Collaboration"
echo "   • PWA Support"
echo ""
echo "♿ Accessibility Features:"
echo "   • WCAG 2.1 AA Compliance"
echo "   • Screen Reader Support"
echo "   • Keyboard Navigation"
echo "   • Focus Management"
echo ""