'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <main className="min-h-screen py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/">← ホームに戻る</Link>
          </Button>
          <h1 className="text-3xl font-bold">❓ ヘルプ</h1>
          <p className="text-gray-600 mt-2">
            家族の音声メッセージアプリの使い方をご案内します。
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🚀 はじめに</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. アカウント作成</h3>
                <p className="text-gray-600">メールアドレスとパスワードでアカウントを作成してください。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. プロフィール設定</h3>
                <p className="text-gray-600">表示名を設定して、家族に分かりやすくしましょう。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. 家族を招待</h3>
                <p className="text-gray-600">家族のメールアドレスを招待して、つながりましょう。</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🎤 音声メッセージの使い方</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">録音方法</h3>
                <p className="text-gray-600">録音ボタンを押して、心込めたメッセージを録音してください。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">送信方法</h3>
                <p className="text-gray-600">録音完了後、家族を選択してメッセージを送信できます。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">再生方法</h3>
                <p className="text-gray-600">受信したメッセージは再生ボタンで聞くことができます。</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>👨‍👩‍👧‍👦 家族管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">家族の招待</h3>
                <p className="text-gray-600">招待機能を使って、家族をアプリに招待できます。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">つながりの承認</h3>
                <p className="text-gray-600">招待された側は、つながりを承認する必要があります。</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔧 よくある問題</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">マイクが使えない</h3>
                <p className="text-gray-600">ブラウザの設定でマイクの使用を許可してください。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">音声が聞こえない</h3>
                <p className="text-gray-600">デバイスの音量設定を確認してください。</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">メッセージが送信できない</h3>
                <p className="text-gray-600">インターネット接続を確認し、ページを再読み込みしてください。</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📞 お問い合わせ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                その他ご不明な点がございましたら、サポートまでお問い合わせください。
              </p>
              <div className="mt-4">
                <Button variant="outline">
                  サポートに連絡
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}