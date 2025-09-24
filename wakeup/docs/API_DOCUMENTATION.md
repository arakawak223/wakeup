# WakeUp Voice Messaging API Documentation
# WakeUp音声メッセージング API ドキュメント

Version: 1.0.0
Base URL: `https://api.wakeup.app/v1`
Authentication: Bearer Token (JWT)

## Table of Contents / 目次

1. [Authentication / 認証](#authentication--認証)
2. [Voice Messages / 音声メッセージ](#voice-messages--音声メッセージ)
3. [User Management / ユーザー管理](#user-management--ユーザー管理)
4. [Progressive Features / プログレッシブ機能](#progressive-features--プログレッシブ機能)
5. [Monitoring / 監視](#monitoring--監視)
6. [Security / セキュリティ](#security--セキュリティ)
7. [Tenant Management / テナント管理](#tenant-management--テナント管理)
8. [Error Handling / エラーハンドリング](#error-handling--エラーハンドリング)
9. [Rate Limiting / レート制限](#rate-limiting--レート制限)
10. [Webhooks / Webhook](#webhooks--webhook)

## Authentication / 認証

### Login / ログイン

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_12345",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "tokens": {
      "access_token": "jwt_access_token_here",
      "refresh_token": "jwt_refresh_token_here",
      "expires_in": 3600
    }
  }
}
```

### Refresh Token / トークンリフレッシュ

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "jwt_refresh_token_here"
}
```

### Logout / ログアウト

```http
POST /auth/logout
Authorization: Bearer jwt_access_token_here
```

## Voice Messages / 音声メッセージ

### Create Voice Message / 音声メッセージ作成

```http
POST /voice/messages
Authorization: Bearer jwt_access_token_here
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `audio`: Audio file (WAV, MP3, M4A, WebM, OGG)
- `title`: String (optional)
- `description`: String (optional)
- `privacy`: String ("public", "private", "unlisted")
- `tags`: Array of strings (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_12345",
    "title": "Morning Greeting",
    "description": "Daily morning message",
    "duration": 15.5,
    "file_url": "https://storage.wakeup.app/voice/msg_12345.wav",
    "privacy": "private",
    "tags": ["greeting", "daily"],
    "created_at": "2024-01-20T10:30:00Z",
    "updated_at": "2024-01-20T10:30:00Z",
    "user": {
      "id": "user_12345",
      "name": "John Doe"
    },
    "analytics": {
      "play_count": 0,
      "like_count": 0,
      "share_count": 0
    }
  }
}
```

### List Voice Messages / 音声メッセージ一覧

```http
GET /voice/messages?page=1&limit=20&privacy=private&tags=greeting
Authorization: Bearer jwt_access_token_here
```

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 20, max: 100)
- `privacy`: String ("public", "private", "unlisted")
- `tags`: String (comma-separated)
- `search`: String
- `sort`: String ("created_at", "updated_at", "duration", "play_count")
- `order`: String ("asc", "desc")

### Get Voice Message / 音声メッセージ取得

```http
GET /voice/messages/:id
Authorization: Bearer jwt_access_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_12345",
    "title": "Morning Greeting",
    "description": "Daily morning message",
    "duration": 15.5,
    "file_url": "https://storage.wakeup.app/voice/msg_12345.wav",
    "waveform": [0.1, 0.3, 0.8, 0.2, ...],
    "privacy": "private",
    "tags": ["greeting", "daily"],
    "created_at": "2024-01-20T10:30:00Z",
    "updated_at": "2024-01-20T10:30:00Z",
    "user": {
      "id": "user_12345",
      "name": "John Doe",
      "avatar_url": "https://storage.wakeup.app/avatars/user_12345.jpg"
    },
    "analytics": {
      "play_count": 15,
      "like_count": 3,
      "share_count": 1,
      "comments_count": 2
    }
  }
}
```

### Update Voice Message / 音声メッセージ更新

```http
PUT /voice/messages/:id
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "title": "Updated Morning Greeting",
  "description": "Updated daily morning message",
  "privacy": "public",
  "tags": ["greeting", "daily", "updated"]
}
```

### Delete Voice Message / 音声メッセージ削除

```http
DELETE /voice/messages/:id
Authorization: Bearer jwt_access_token_here
```

## User Management / ユーザー管理

### Get User Profile / ユーザープロフィール取得

```http
GET /users/profile
Authorization: Bearer jwt_access_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_12345",
    "email": "user@example.com",
    "name": "John Doe",
    "bio": "Voice message enthusiast",
    "avatar_url": "https://storage.wakeup.app/avatars/user_12345.jpg",
    "settings": {
      "notifications": {
        "email": true,
        "push": true,
        "comments": true,
        "likes": false
      },
      "privacy": {
        "profile_visibility": "public",
        "message_default_privacy": "private"
      }
    },
    "statistics": {
      "total_messages": 25,
      "total_plays": 150,
      "total_likes": 23,
      "followers": 12,
      "following": 8
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Update User Profile / ユーザープロフィール更新

```http
PUT /users/profile
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "name": "John Updated",
  "bio": "Updated bio",
  "settings": {
    "notifications": {
      "email": false,
      "push": true
    }
  }
}
```

### Upload Avatar / アバター画像アップロード

```http
POST /users/avatar
Authorization: Bearer jwt_access_token_here
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `avatar`: Image file (PNG, JPG, JPEG, max 5MB)

## Progressive Features / プログレッシブ機能

### Feature Detection / 機能検出

```http
GET /features/detect
Authorization: Bearer jwt_access_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "browser_features": {
      "media_recorder": true,
      "web_audio": true,
      "web_rtc": true,
      "service_worker": true,
      "push_notifications": true
    },
    "supported_formats": {
      "audio": ["wav", "mp3", "webm", "ogg"],
      "video": ["mp4", "webm"]
    },
    "recommended_settings": {
      "audio_quality": "high",
      "fallback_format": "wav"
    }
  }
}
```

### Progressive Upload / プログレッシブアップロード

```http
POST /voice/progressive-upload
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "chunk_id": "chunk_1_of_5",
  "chunk_data": "base64_encoded_audio_chunk",
  "chunk_index": 1,
  "total_chunks": 5,
  "session_id": "upload_session_12345"
}
```

## Monitoring / 監視

### Production Metrics / プロダクションメトリクス

```http
GET /monitoring/metrics
Authorization: Bearer jwt_access_token_here (Admin only)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_metrics": {
      "session_id": "session_12345",
      "event_count": 42,
      "error_count": 1,
      "warning_count": 3,
      "last_activity": "2024-01-20T10:30:00Z"
    },
    "performance_metrics": {
      "core_web_vitals": {
        "lcp": 1200,
        "fid": 50,
        "cls": 0.05
      },
      "memory_usage": 45.6,
      "heap_size": 25600000,
      "connection_count": 15
    },
    "business_metrics": {
      "total_users": 1250,
      "active_users_24h": 89,
      "total_messages": 5420,
      "storage_usage_gb": 45.7
    }
  }
}
```

### Log Events / イベントログ

```http
POST /monitoring/events
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "level": "info",
  "category": "user_action",
  "message": "Voice message played",
  "details": {
    "message_id": "msg_12345",
    "duration": 15.5,
    "completion_rate": 0.8
  }
}
```

## Security / セキュリティ

### Security Status / セキュリティ状態

```http
GET /security/status
Authorization: Bearer jwt_access_token_here (Admin only)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encryption": {
      "status": "active",
      "algorithm": "RSA-4096 + AES-256",
      "key_rotation_date": "2024-01-15T00:00:00Z"
    },
    "security_events": {
      "total_events": 147,
      "critical_events": 2,
      "high_events": 8,
      "blocked_requests": 67
    },
    "compliance": {
      "gdpr_compliant": true,
      "ccpa_compliant": true,
      "data_subject_requests": 7,
      "average_response_time_hours": 18
    }
  }
}
```

### Export Public Key / 公開キーエクスポート

```http
GET /security/keys/public
Authorization: Bearer jwt_access_token_here
```

### Data Subject Request / データ主体の権利要求

```http
POST /security/data-subject-request
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "request_type": "access", // "access", "portability", "erasure"
  "reason": "GDPR Article 15 request"
}
```

## Tenant Management / テナント管理

### Get Tenant Info / テナント情報取得

```http
GET /tenants/current
Authorization: Bearer jwt_access_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tenant_12345",
    "name": "Demo Corporation",
    "domain": "demo.wakeup.app",
    "plan": "pro",
    "limits": {
      "max_users": 100,
      "max_storage": 10000,
      "max_messages": 50000,
      "max_voice_minutes": 1000
    },
    "usage": {
      "users": 67,
      "storage": 7800,
      "messages": 28500,
      "voice_minutes": 420
    },
    "features": {
      "encryption": true,
      "analytics": true,
      "custom_branding": true,
      "api_access": true,
      "sso": false
    }
  }
}
```

### Get Tenant Usage / テナント使用量取得

```http
GET /tenants/usage
Authorization: Bearer jwt_access_token_here
```

### Get Scaling Recommendations / スケーリング推奨事項

```http
GET /tenants/scaling/recommendations
Authorization: Bearer jwt_access_token_here (Admin only)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      "ストレージ使用量が制限の78%に達しています",
      "メモリ使用量を最適化できます"
    ],
    "metrics": {
      "cpu": 65.2,
      "memory": 78.4,
      "storage": 78.0,
      "connections": 134
    },
    "suggested_actions": [
      "ストレージクリーンアップまたはプラン升级を検討してください",
      "メモリ使用量の最適化を実行してください"
    ]
  }
}
```

## Error Handling / エラーハンドリング

All API endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2024-01-20T10:30:00Z",
    "request_id": "req_12345"
  }
}
```

### Common Error Codes / よくあるエラーコード

- `AUTHENTICATION_ERROR`: 認証エラー
- `AUTHORIZATION_ERROR`: 認可エラー
- `VALIDATION_ERROR`: バリデーションエラー
- `NOT_FOUND`: リソースが見つからない
- `RATE_LIMIT_EXCEEDED`: レート制限に達した
- `QUOTA_EXCEEDED`: クォータ制限に達した
- `INTERNAL_SERVER_ERROR`: サーバー内部エラー
- `SERVICE_UNAVAILABLE`: サービス利用不可

## Rate Limiting / レート制限

API calls are rate limited per user/tenant:

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Voice Upload | 10 uploads | 1 hour |
| Admin API | 1000 requests | 15 minutes |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1640995200
```

## Webhooks / Webhook

### Register Webhook / Webhook登録

```http
POST /webhooks
Authorization: Bearer jwt_access_token_here
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/wakeup",
  "events": ["voice.created", "voice.updated", "voice.deleted", "user.updated"],
  "secret": "your_webhook_secret"
}
```

### Webhook Events / Webhookイベント

#### Voice Message Created

```json
{
  "event": "voice.created",
  "timestamp": "2024-01-20T10:30:00Z",
  "data": {
    "id": "msg_12345",
    "title": "New Voice Message",
    "user_id": "user_12345",
    "created_at": "2024-01-20T10:30:00Z"
  }
}
```

#### Voice Message Updated

```json
{
  "event": "voice.updated",
  "timestamp": "2024-01-20T10:35:00Z",
  "data": {
    "id": "msg_12345",
    "changes": {
      "title": {
        "old": "Old Title",
        "new": "New Title"
      }
    },
    "updated_at": "2024-01-20T10:35:00Z"
  }
}
```

## SDK Examples / SDKサンプル

### JavaScript/TypeScript SDK

```typescript
import { WakeUpAPI } from '@wakeup/api-client'

const api = new WakeUpAPI({
  baseURL: 'https://api.wakeup.app/v1',
  apiKey: 'your_api_key'
})

// Upload voice message
const voiceMessage = await api.voice.create({
  audio: audioFile,
  title: 'My Voice Message',
  privacy: 'private'
})

// Get messages
const messages = await api.voice.list({
  page: 1,
  limit: 20,
  privacy: 'private'
})

// Progressive upload
await api.voice.progressiveUpload({
  chunks: audioChunks,
  metadata: {
    title: 'Large Voice Message',
    privacy: 'private'
  }
})
```

### Python SDK

```python
from wakeup_api import WakeUpClient

client = WakeUpClient(
    base_url='https://api.wakeup.app/v1',
    api_key='your_api_key'
)

# Upload voice message
with open('audio.wav', 'rb') as audio_file:
    message = client.voice.create(
        audio=audio_file,
        title='My Voice Message',
        privacy='private'
    )

# Get messages
messages = client.voice.list(
    page=1,
    limit=20,
    privacy='private'
)
```

### cURL Examples / cURLサンプル

```bash
# Login
curl -X POST https://api.wakeup.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Upload voice message
curl -X POST https://api.wakeup.app/v1/voice/messages \
  -H "Authorization: Bearer your_jwt_token" \
  -F "audio=@voice.wav" \
  -F "title=My Voice Message" \
  -F "privacy=private"

# Get messages
curl -X GET "https://api.wakeup.app/v1/voice/messages?page=1&limit=20" \
  -H "Authorization: Bearer your_jwt_token"
```

## Versioning / バージョニング

The API uses semantic versioning. Current version is `v1`.

- **Major versions** introduce breaking changes
- **Minor versions** add new features backward-compatible
- **Patch versions** contain bug fixes and improvements

Version is specified in the URL path: `/v1/`, `/v2/`, etc.

## Support / サポート

- **Documentation**: https://docs.wakeup.app/api
- **Status Page**: https://status.wakeup.app
- **Support Email**: api-support@wakeup.app
- **Discord Community**: https://discord.gg/wakeup-dev

## Changelog / 変更履歴

### v1.0.0 - 2024-01-20

- Initial API release
- Voice message CRUD operations
- User management
- Progressive enhancement features
- Security and monitoring endpoints
- Multi-tenant support
- Webhook system

---

*This documentation is generated automatically and kept up-to-date with the latest API changes.*