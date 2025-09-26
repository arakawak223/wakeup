# 🎙️ Wakeup - エンタープライズグレード音声メッセージプラットフォーム

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Real--time-green)](https://supabase.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://www.docker.com/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-purple)](https://web.dev/progressive-web-apps/)

**家族の絆を深める音声メッセージプラットフォーム - エンタープライズグレードのセキュリティ、パフォーマンス、アクセシビリティを備えた本格的なプロダクションレディアプリケーション**

🎯 **本番環境対応済み** | 🔐 **エンタープライズセキュリティ** | 🚀 **CI/CDパイプライン完備** | 📊 **包括的監視システム**

## 🌟 主要機能

### 🎵 音声処理機能
- **高品質音声録音**: Web Audio API を使用した48kHz/16bit録音
- **リアルタイム音声可視化**: 6種類の可視化モード（波形、周波数、3D等）
- **音響効果処理**: リバーブ、エコー、コーラス、フィルター効果
- **自動マイクテスト**: 音質診断と環境最適化提案
- **音声圧縮最適化**: 高品質でファイルサイズを最小化

### 🔐 セキュリティ・プライバシー
- **エンドツーエンド暗号化**: RSA-4096 + AES-256暗号化
- **GDPR/CCPA準拠**: 完全なプライバシー保護
- **デジタル署名**: メッセージの完全性保証
- **プライバシーコントロール**: きめ細かい権限設定
- **データ暗号化**: 保存時・転送時の完全暗号化

### 🚀 リアルタイム・コラボレーション
- **マルチユーザー対応**: Supabaseリアルタイム通信
- **同期録音・再生**: 複数参加者での同時操作
- **プレゼンス機能**: オンラインユーザー表示
- **リアルタイム通知**: 瞬時のメッセージ配信
- **共同編集**: 音声メッセージの協調作業

### ♿ アクセシビリティ
- **WCAG 2.1 AA準拠**: 完全なアクセシビリティ対応
- **スクリーンリーダー対応**: 音声読み上げ最適化
- **キーボードナビゲーション**: マウス不要の完全操作
- **フォーカス管理**: 直感的なUI操作
- **多言語対応**: 国際化対応

### ⚡ パフォーマンス
- **Service Worker**: オフライン対応とキャッシング
- **Progressive Web App**: ネイティブアプリ体験
- **Core Web Vitals**: 最適化されたUX指標
- **レイジーローディング**: 必要時のみリソース読み込み
- **メモリ管理**: 効率的なリソース使用

## 🏗️ 技術スタック

### フロントエンド
- **Next.js 15.5.3**: フルスタックReactフレームワーク
- **TypeScript**: 型安全な開発環境
- **Tailwind CSS**: ユーティリティファーストCSS
- **Radix UI**: アクセシブルなUI primitives
- **Lucide React**: 美しいアイコンライブラリ

### バックエンド・データベース
- **Supabase**: PostgreSQL + リアルタイム機能
- **Web Audio API**: 高度な音声処理
- **IndexedDB**: クライアントサイドデータ保存
- **Service Worker**: オフライン機能とキャッシング

### 開発・運用
- **Jest + React Testing Library**: 包括的テストスイート
- **GitHub Actions**: CI/CD パイプライン
- **Docker**: コンテナ化deployment
- **Nginx**: リバースプロキシとロードバランシング

## 🚀 クイックスタート

### 前提条件
- Node.js 18+
- npm または yarn
- Docker (本番環境用)
- Supabase プロジェクト

### 開発環境セットアップ

1. **リポジトリをクローン**
```bash
git clone <repository-url>
cd wakeup
```

2. **依存関係をインストール**
```bash
npm install
```

3. **環境変数を設定**
```bash
cp .env.example .env.local
# .env.local を編集してSupabase認証情報を設定
```

4. **開発サーバーを起動**
```bash
npm run dev
```

5. **ブラウザでアクセス**
```
http://localhost:3000
```

### プロダクション展開

1. **環境変数を設定**
```bash
cp .env.production.example .env.production
# 本番環境の認証情報を設定
```

2. **Docker Composeで展開**
```bash
./scripts/deploy.sh
```

3. **アクセス確認**
```
https://localhost (SSL対応)
```

## 📱 主要画面

### 🏠 ホーム画面
- 音声録音・再生の中央制御
- クイックアクセス機能群
- リアルタイムユーザー状態

### 🎤 録音・再生画面
- 高品質音声録音インターフェース
- リアルタイム音声可視化
- 録音コントロールとプレビュー

### 👥 コラボレーション画面
- マルチユーザー音声セッション
- リアルタイム参加者表示
- 同期録音・再生機能

### 🔒 セキュリティ管理画面
- 暗号化設定とキー管理
- プライバシー設定コントロール
- データ保護状態監視

### ♿ アクセシビリティ画面
- 支援技術設定
- カスタマイゼーション オプション
- ユーザビリティ調整

### 📊 パフォーマンス監視画面
- Core Web Vitals メトリクス
- リソース使用状況監視
- パフォーマンス最適化提案

## 🧪 テスト

### 全テスト実行
```bash
npm test
```

### カバレッジ付きテスト
```bash
npm run test:coverage
```

### 統合テスト
```bash
npm run test:integration
```

### アクセシビリティテスト
```bash
npm run test:a11y
```

## 📋 使用可能なスクリプト

### 開発
- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLintによるコード検査
- `npm run type-check` - TypeScript型チェック

### テスト
- `npm test` - テスト実行
- `npm run test:watch` - ウォッチモードでテスト
- `npm run test:coverage` - カバレッジレポート生成

### 運用
- `./scripts/deploy.sh` - プロダクション展開
- `docker-compose up` - 開発環境Docker起動
- `docker-compose -f docker-compose.production.yml up` - 本番環境起動

## 🏗️ アーキテクチャ

```
/wakeup
├── app/                     # Next.js App Router
│   ├── page.tsx            # ホーム画面
│   ├── collaboration/      # リアルタイムコラボレーション
│   ├── security/          # セキュリティ管理
│   ├── accessibility/     # アクセシビリティ設定
│   └── performance/       # パフォーマンス監視
├── components/             # Reactコンポーネント
│   ├── audio/             # 音声関連コンポーネント
│   ├── collaboration/     # コラボレーション機能
│   ├── security/          # セキュリティ機能
│   ├── accessibility/     # アクセシビリティ機能
│   └── ui/                # 基本UIコンポーネント
├── lib/                   # ユーティリティライブラリ
│   ├── audio/             # 音声処理ライブラリ
│   ├── security/          # セキュリティ・暗号化
│   ├── realtime/          # リアルタイム通信
│   ├── accessibility/     # アクセシビリティ支援
│   └── performance/       # パフォーマンス最適化
├── contexts/              # React Context
├── hooks/                 # カスタムフック
├── __tests__/             # テストファイル
├── public/                # 静的アセット
├── nginx/                 # Nginx設定
└── scripts/               # デプロイメントスクリプト
```

## 🔧 使用可能なスクリプト

- **開発用コマンド**
  - `npm run dev` - 開発サーバー起動
  - `npm run build` - プロダクションビルド
  - `npm run start` - プロダクションサーバー起動
  - `npm run lint` - コード検査
  - `npm run type-check` - 型チェック

- **テスト用コマンド**
  - `npm test` - テスト実行
  - `npm run test:coverage` - カバレッジ付きテスト

## 🛠️ 環境設定

環境変数は `.env.local` ファイルで設定してください：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📝 ライセンス

MIT License

---

**🎙️ Wakeup - 家族の声を、安全に、美しく繋げる**