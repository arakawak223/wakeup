# 🚀 本番環境セットアップガイド

## 📋 本番デプロイ前の必須設定

### 1. 環境変数の設定

以下の値を `.env.production` に設定してください：

#### セキュリティ設定
```bash
# 生成されたセキュリティソルト（32バイトのランダム値）
SECURITY_SALT=9dad1ac0237d32240b59828a5d93c2f92c6e4b864b95f64218ba40efc344820b

# IP検証の厳格化
STRICT_IP_VALIDATION=true
```

#### VAPID Keys（プッシュ通知用）
```bash
# 生成されたVAPIDキー
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHzA0NNHf0evHlRSakn4kZBnVgeoAyfAUCvTpe3DkzjB5XnR111VK2GjX0Kt2L7RAiFjsaPAY7nWs43avihAADQ
VAPID_PRIVATE_KEY=BmNj1me24SnpsRezZ4ls-OUU27u0rCkCXFbRP0cLGn4
VAPID_SUBJECT=mailto:your-email@domain.com
```

#### Supabase設定（実際の値に置き換え）
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SECRET_KEY=your-actual-secret-key
```

#### ドメイン設定
```bash
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_APP_DOMAIN=yourdomain.com
```

### 2. SSL証明書の設定

#### Let's Encrypt（推奨）
```bash
# Certbot をインストール
sudo apt-get install certbot

# SSL証明書を取得
sudo certbot certonly --standalone -d yourdomain.com

# 証明書ファイルをnginx/ssl/にコピー
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
```

#### 自動更新の設定
```bash
# crontab に追加
0 2 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

### 3. Nginxの本番設定

`nginx/nginx.conf` を更新：

```nginx
upstream nextjs {
    server app:3000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Docker本番デプロイ

#### Multi-stage Dockerfileの確認
```dockerfile
# 本番ビルド最適化
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

#### docker-compose.prod.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    restart: unless-stopped
    depends_on:
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 5. セキュリティ強化

#### Fail2Banの設定
```bash
sudo apt-get install fail2ban

# /etc/fail2ban/jail.local を作成
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
```

#### UFWファイアウォール
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 6. 監視・ログ設定

#### ログ設定
```yaml
# docker-compose.prod.yml に追加
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

#### ヘルスチェック
```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 7. デプロイメント

```bash
# 本番環境にデプロイ
docker-compose -f docker-compose.prod.yml up -d

# ログの確認
docker-compose -f docker-compose.prod.yml logs -f

# SSL証明書の確認
openssl s509 -in nginx/ssl/cert.pem -text -noout
```

### 8. 本番後の確認項目

- [ ] HTTPS接続の確認
- [ ] SSL証明書の有効性確認
- [ ] セキュリティヘッダーの確認
- [ ] プッシュ通知の動作確認
- [ ] パフォーマンス監視の確認
- [ ] ログ出力の確認
- [ ] バックアップの設定
- [ ] 定期的なセキュリティスキャン

### 🚨 セキュリティチェックリスト

- [x] 強力なセキュリティソルト生成済み
- [x] VAPIDキー生成済み
- [ ] SSL証明書設置済み
- [ ] ファイアウォール設定済み
- [ ] Fail2Ban設定済み
- [ ] ログ監視設定済み
- [ ] 定期バックアップ設定済み

---

**⚠️ 重要**: プロダクション環境では必ず上記の全設定を完了してからデプロイしてください。