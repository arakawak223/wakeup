# 🔌 WakeUp API Reference

WakeUp APIは RESTful API として設計され、音声メッセージング、リアルタイムコラボレーション、セキュリティ機能を提供します。

## 📋 API概要

### ベースURL
```
https://yourdomain.com/api/v1
```

### 認証方式
- **JWT Bearer Token**: メイン認証
- **Session Cookie**: Web UI用
- **API Key**: サービス間通信用

### レスポンス形式
```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "req_123456789"
}
```

### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid format"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "req_123456789"
}
```

## 🔐 認証エンドポイント

### POST /auth/signup
新規ユーザー登録

**リクエスト:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### POST /auth/signin
ユーザーログイン

**リクエスト:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### POST /auth/refresh
トークンリフレッシュ

**Headers:**
```
Authorization: Bearer <refresh_token>
```

### POST /auth/signout
ログアウト

**Headers:**
```
Authorization: Bearer <access_token>
```

### POST /auth/forgot-password
パスワードリセット要求

**リクエスト:**
```json
{
  "email": "user@example.com"
}
```

## 👤 ユーザー管理エンドポイント

### GET /users/profile
ユーザープロフィール取得

**Headers:**
```
Authorization: Bearer <access_token>
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "preferences": {
      "audioQuality": "high",
      "notifications": true,
      "theme": "dark"
    },
    "statistics": {
      "messagesCount": 150,
      "totalDuration": 7200000,
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### PUT /users/profile
ユーザープロフィール更新

**リクエスト:**
```json
{
  "name": "Jane Doe",
  "preferences": {
    "audioQuality": "medium",
    "notifications": false
  }
}
```

### GET /users/{userId}
特定ユーザー情報取得（公開情報のみ）

### POST /users/avatar
アバター画像アップロード

**Content-Type:** `multipart/form-data`

## 🎙️ 音声メッセージエンドポイント

### POST /messages/voice
音声メッセージ送信

**Content-Type:** `multipart/form-data`

**Form Data:**
- `audio`: 音声ファイル（WebM/MP3/WAV）
- `metadata`: JSON metadata
```json
{
  "duration": 30000,
  "recipients": ["user_456", "user_789"],
  "roomId": "room_123",
  "quality": "high"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg_123456",
    "url": "https://cdn.example.com/audio/encrypted_123456.webm",
    "duration": 30000,
    "size": 245760,
    "checksum": "sha256:abc123...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /messages
音声メッセージ一覧取得

**クエリパラメータ:**
- `page`: ページ番号（デフォルト: 1）
- `limit`: 件数（デフォルト: 20, 最大: 100）
- `roomId`: ルームID（フィルター）
- `senderId`: 送信者ID（フィルター）
- `startDate`: 開始日時（ISO8601）
- `endDate`: 終了日時（ISO8601）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123456",
        "senderId": "user_456",
        "senderName": "Alice",
        "roomId": "room_123",
        "duration": 30000,
        "url": "https://cdn.example.com/audio/encrypted_123456.webm",
        "createdAt": "2024-01-01T00:00:00Z",
        "isRead": false,
        "reactions": [
          {
            "emoji": "👍",
            "count": 3,
            "users": ["user_789", "user_101", "user_102"]
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### GET /messages/{messageId}
特定メッセージ詳細取得

### PUT /messages/{messageId}/reactions
メッセージリアクション追加

**リクエスト:**
```json
{
  "emoji": "👍",
  "action": "add"
}
```

### DELETE /messages/{messageId}
メッセージ削除

### POST /messages/{messageId}/transcription
音声メッセージの文字起こし

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "transcription": "Hello, how are you today?",
    "confidence": 0.95,
    "language": "en",
    "timestamps": [
      {
        "word": "Hello",
        "start": 0.1,
        "end": 0.5
      }
    ]
  }
}
```

## 🏠 ルーム管理エンドポイント

### GET /rooms
ルーム一覧取得

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "room_123",
        "name": "Team Discussion",
        "description": "Daily team sync",
        "isPrivate": false,
        "memberCount": 5,
        "createdBy": "user_456",
        "createdAt": "2024-01-01T00:00:00Z",
        "lastActivity": "2024-01-02T10:30:00Z"
      }
    ]
  }
}
```

### POST /rooms
新規ルーム作成

**リクエスト:**
```json
{
  "name": "New Project Discussion",
  "description": "Project planning and updates",
  "isPrivate": true,
  "maxMembers": 10,
  "settings": {
    "allowRecording": true,
    "autoTranscription": false,
    "moderationEnabled": true
  }
}
```

### GET /rooms/{roomId}
ルーム詳細取得

### PUT /rooms/{roomId}
ルーム設定更新

### DELETE /rooms/{roomId}
ルーム削除

### POST /rooms/{roomId}/members
ルームメンバー追加

**リクエスト:**
```json
{
  "userIds": ["user_789", "user_101"],
  "role": "member"
}
```

### GET /rooms/{roomId}/members
ルームメンバー一覧

### DELETE /rooms/{roomId}/members/{userId}
メンバー削除

## 🎭 リアルタイム通信エンドポイント

### WebSocket接続
```javascript
const ws = new WebSocket('wss://yourdomain.com/api/v1/ws');

// 認証
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your_jwt_token'
}));

// ルーム参加
ws.send(JSON.stringify({
  type: 'join_room',
  roomId: 'room_123'
}));
```

### WebSocket イベント

**サーバー → クライアント:**
```json
{
  "type": "message_received",
  "data": {
    "messageId": "msg_123456",
    "senderId": "user_456",
    "roomId": "room_123",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**クライアント → サーバー:**
```json
{
  "type": "typing_start",
  "roomId": "room_123"
}
```

### WebRTC Signaling
```json
{
  "type": "webrtc_offer",
  "data": {
    "targetUserId": "user_456",
    "sdp": "v=0\r\no=...",
    "type": "offer"
  }
}
```

## 🔐 暗号化エンドポイント

### POST /crypto/keys
公開鍵登録

**リクエスト:**
```json
{
  "publicKey": "-----BEGIN RSA PUBLIC KEY-----\n...",
  "keyId": "key_123",
  "algorithm": "RSA-4096"
}
```

### GET /crypto/keys/{userId}
ユーザーの公開鍵取得

### POST /crypto/exchange
鍵交換プロセス開始

**リクエスト:**
```json
{
  "targetUserId": "user_456",
  "encryptedSymmetricKey": "base64_encoded_encrypted_key",
  "keyId": "key_123"
}
```

## 📊 分析・統計エンドポイント

### GET /analytics/usage
使用統計取得

**クエリパラメータ:**
- `period`: daily | weekly | monthly
- `startDate`: 開始日
- `endDate`: 終了日

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "period": "daily",
    "metrics": [
      {
        "date": "2024-01-01",
        "messagesCount": 45,
        "duration": 2700000,
        "activeUsers": 12
      }
    ],
    "totals": {
      "messagesCount": 450,
      "totalDuration": 27000000,
      "averageMessageLength": 60000
    }
  }
}
```

### GET /analytics/performance
パフォーマンスメトリクス

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "responseTime": {
      "average": 150,
      "p95": 300,
      "p99": 500
    },
    "errorRate": 0.001,
    "throughput": 1000,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## 🔍 検索エンドポイント

### GET /search/messages
メッセージ検索

**クエリパラメータ:**
- `q`: 検索クエリ
- `type`: audio | transcription | both
- `roomId`: ルーム内検索
- `dateRange`: 期間指定

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "messageId": "msg_123456",
        "relevanceScore": 0.95,
        "snippet": "...matching text...",
        "highlightedText": "matching <mark>keyword</mark>",
        "metadata": {
          "senderId": "user_456",
          "roomId": "room_123",
          "createdAt": "2024-01-01T00:00:00Z"
        }
      }
    ],
    "totalResults": 25,
    "searchTime": 0.045
  }
}
```

## 📱 プッシュ通知エンドポイント

### POST /notifications/subscribe
プッシュ通知登録

**リクエスト:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "base64_encoded_key",
    "auth": "base64_encoded_auth"
  },
  "deviceType": "web",
  "preferences": {
    "newMessages": true,
    "mentions": true,
    "roomInvites": true
  }
}
```

### PUT /notifications/preferences
通知設定更新

### POST /notifications/test
テスト通知送信

## 🛠️ 管理者エンドポイント

### GET /admin/users
全ユーザー一覧（管理者のみ）

### GET /admin/system/health
システムヘルスチェック

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": {
        "status": "healthy",
        "responseTime": 12,
        "connections": 45
      },
      "redis": {
        "status": "healthy",
        "memory": "256MB",
        "hits": 95.5
      },
      "storage": {
        "status": "healthy",
        "usage": "45%",
        "freeSpace": "1.2TB"
      }
    },
    "uptime": 86400,
    "version": "1.0.0",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### GET /admin/metrics
システムメトリクス

### POST /admin/maintenance
メンテナンスモード切り替え

## 📋 エラーコード一覧

| コード | HTTP | 説明 |
|--------|------|------|
| VALIDATION_ERROR | 400 | 入力データ検証エラー |
| UNAUTHORIZED | 401 | 認証エラー |
| FORBIDDEN | 403 | アクセス権限なし |
| NOT_FOUND | 404 | リソースが見つからない |
| CONFLICT | 409 | データ競合エラー |
| RATE_LIMITED | 429 | レート制限超過 |
| INTERNAL_ERROR | 500 | 内部サーバーエラー |
| SERVICE_UNAVAILABLE | 503 | サービス利用不可 |

## 🔄 レート制限

### 制限レベル
- **認証API**: 5 req/min
- **音声アップロード**: 10 req/min
- **メッセージ取得**: 100 req/min
- **WebSocket**: 50 msgs/min

### ヘッダー情報
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## 📡 Webhook

### 設定
```json
{
  "url": "https://your-app.com/webhooks/wakeup",
  "events": ["message.created", "room.member_joined"],
  "secret": "your_webhook_secret"
}
```

### イベント例
```json
{
  "event": "message.created",
  "data": {
    "messageId": "msg_123456",
    "senderId": "user_456",
    "roomId": "room_123"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "signature": "sha256=..."
}
```

## 🔧 SDK & ライブラリ

### JavaScript/TypeScript SDK
```bash
npm install @wakeup/sdk
```

```javascript
import { WakeUpClient } from '@wakeup/sdk';

const client = new WakeUpClient({
  apiUrl: 'https://yourdomain.com/api/v1',
  token: 'your_jwt_token'
});

// 音声メッセージ送信
await client.messages.send({
  audio: audioBlob,
  recipients: ['user_456']
});
```

### Python SDK
```bash
pip install wakeup-sdk
```

```python
from wakeup_sdk import WakeUpClient

client = WakeUpClient(
    api_url='https://yourdomain.com/api/v1',
    token='your_jwt_token'
)

# ルーム一覧取得
rooms = client.rooms.list()
```

---

## 📞 サポート

- **API サポート**: api-support@wakeup.com
- **ドキュメント**: https://docs.wakeup.com
- **GitHub**: https://github.com/wakeup-app/wakeup
- **Status Page**: https://status.wakeup.com

**🔗 このAPIリファレンスは随時更新されます。最新情報は公式ドキュメントをご確認ください。**