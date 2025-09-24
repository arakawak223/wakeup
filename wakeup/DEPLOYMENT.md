# 🚀 Wakeup - 本番環境展開ガイド

## 📋 展開前チェックリスト

### ✅ 必要な環境変数
```bash
# 必須設定項目
NEXT_PUBLIC_SUPABASE_URL          # Supabaseプロジェクトurl
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase認証キー
SUPABASE_SECRET_KEY               # Supabaseサービスキー

# オプション設定
NEXTAUTH_SECRET                   # 認証シークレット
NEXTAUTH_URL                      # 認証ベースURL
LOG_LEVEL                         # ログレベル (warn推奨)
```

### ✅ システム要件
- **Node.js**: 18.0.0 以上
- **Docker**: 20.10.0 以上
- **Docker Compose**: 2.0.0 以上
- **RAM**: 最低 2GB、推奨 4GB以上
- **Storage**: 最低 10GB の空き容量

## 🔧 展開手順

### 1. 事前準備
```bash
# リポジトリクローン
git clone <repository-url>
cd wakeup

# 権限設定
chmod +x scripts/deploy.sh
```

### 2. 環境設定
```bash
# 本番環境変数設定
cp .env.production.example .env.production
# .env.production を編集して実際の値を設定
```

### 3. SSL証明書準備（オプション）
```bash
# 自己署名証明書を使用する場合は自動生成されます
# Let's Encryptや正式な証明書を使用する場合：
mkdir -p nginx/ssl
cp your-certificate.pem nginx/ssl/cert.pem
cp your-private-key.pem nginx/ssl/key.pem
```

### 4. 展開実行
```bash
# 自動展開スクリプト実行
./scripts/deploy.sh
```

### 5. 動作確認
```bash
# ヘルスチェック
curl -f http://localhost/health

# アプリケーション確認
curl -f https://localhost
```

## 🏗️ インフラ構成

```
┌─────────────────────┐
│    Load Balancer    │
│      (Nginx)        │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│   Wakeup App        │
│   (Next.js)         │
│   Port: 3000        │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│    Supabase         │
│  (PostgreSQL +      │
│   Realtime)         │
└─────────────────────┘
```

## 🔐 セキュリティ設定

### HTTPS設定
- **TLS**: TLS 1.2, 1.3 のみ許可
- **暗号化**: 強力な暗号スイート使用
- **HSTS**: Strict-Transport-Security ヘッダー有効

### セキュリティヘッダー
```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: 適切なCSPポリシー
```

### ファイアウォール設定
```bash
# 必要なポートのみ開放
Port 80   - HTTP (HTTPS リダイレクト用)
Port 443  - HTTPS
Port 22   - SSH (管理用、IP制限推奨)
```

## 📊 監視・運用

### ヘルスチェック
```bash
# アプリケーションヘルスチェック
GET /health

# レスポンス例
HTTP/1.1 200 OK
Content-Type: text/plain
healthy
```

### ログ監視
```bash
# アプリケーションログ
docker-compose -f docker-compose.production.yml logs -f wakeup-app

# Nginxログ
docker-compose -f docker-compose.production.yml logs -f nginx

# 全サービスログ
docker-compose -f docker-compose.production.yml logs -f
```

### パフォーマンス監視
- **Core Web Vitals**: 自動計測・レポート
- **リソース使用率**: CPU、メモリ、ディスク監視
- **ネットワーク**: レスポンス時間、エラー率監視

## 🔄 更新・運用管理

### アプリケーション更新
```bash
# 最新コードを取得
git pull origin main

# 再展開
./scripts/deploy.sh
```

### バックアップ
```bash
# データベース バックアップ (Supabase管理画面から実行)
# 設定ファイル バックアップ
cp .env.production .env.production.backup.$(date +%Y%m%d)

# SSL証明書バックアップ
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz nginx/ssl/
```

### スケーリング
```bash
# 水平スケーリング (複数インスタンス)
docker-compose -f docker-compose.production.yml up --scale wakeup-app=3 -d

# リソース制限調整
# docker-compose.production.yml の resources セクションを編集
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. アプリケーションが起動しない
```bash
# ログ確認
docker-compose logs wakeup-app

# 環境変数確認
docker-compose exec wakeup-app env | grep SUPABASE
```

#### 2. SSL証明書エラー
```bash
# 証明書の確認
openssl x509 -in nginx/ssl/cert.pem -text -noout

# 証明書の再生成
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes
```

#### 3. データベース接続エラー
- Supabase プロジェクト設定確認
- ネットワーク接続確認
- 認証キーの有効性確認

#### 4. パフォーマンス問題
```bash
# リソース使用状況確認
docker stats

# メモリ使用量最適化
docker-compose restart wakeup-app
```

## 📋 本番運用チェックリスト

### 展開前
- [ ] 環境変数設定完了
- [ ] SSL証明書設置完了
- [ ] バックアップ戦略策定
- [ ] 監視システム設定

### 展開後
- [ ] ヘルスチェック通過
- [ ] 全機能動作確認
- [ ] パフォーマンステスト実行
- [ ] セキュリティスキャン実行

### 定期メンテナンス
- [ ] セキュリティアップデート適用
- [ ] ログローテーション設定
- [ ] バックアップ検証
- [ ] パフォーマンス監視レビュー

## 📞 サポート情報

### 緊急時連絡先
- **システム管理者**: [管理者連絡先]
- **開発チーム**: [開発チーム連絡先]

### リソース
- **ドキュメント**: `/docs`配下の各種ガイド
- **GitHub Issues**: バグレポート・機能要求
- **Monitor Dashboard**: パフォーマンス監視画面

---

**🎯 本番環境での安定運用を実現します！**