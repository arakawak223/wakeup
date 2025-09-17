'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VoiceRecording {
  id: string
  name: string
  url: string
  createdAt: Date
}

interface Alarm {
  id: string
  time: string
  isActive: boolean
  selectedVoiceId: string | null
  voiceName: string
  createdAt: Date
}

export function AlarmManager() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [newAlarmTime, setNewAlarmTime] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('')
  const [currentAlarm, setCurrentAlarm] = useState<Alarm | null>(null)

  // アラームとボイス録音データを読み込み
  useEffect(() => {
    const savedAlarms = localStorage.getItem('alarms')
    if (savedAlarms) {
      try {
        const parsedAlarms = JSON.parse(savedAlarms)
        setAlarms(parsedAlarms.map((a: Alarm & { createdAt: string }) => ({
          ...a,
          createdAt: new Date(a.createdAt)
        })))
      } catch (error) {
        console.error('アラームデータの読み込みに失敗:', error)
      }
    }

    const savedRecordings = localStorage.getItem('voiceRecordings')
    if (savedRecordings) {
      try {
        const parsedRecordings = JSON.parse(savedRecordings)
        setRecordings(parsedRecordings.map((r: VoiceRecording & { createdAt: string }) => ({
          ...r,
          createdAt: new Date(r.createdAt)
        })))
      } catch (error) {
        console.error('音声データの読み込みに失敗:', error)
      }
    }
  }, [])

  const playAlarmVoice = useCallback((alarm: Alarm) => {
    if (alarm.selectedVoiceId) {
      const recording = recordings.find(r => r.id === alarm.selectedVoiceId)
      if (recording) {
        const audio = new Audio(recording.url)
        audio.play().catch(e => console.error('音声再生エラー:', e))
      }
    }
    
    // デフォルトのアラーム音も再生
    const defaultAlarm = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Hzu2UIGWq86+WURTQGGIT/8teEPAoUX7Ps7KJNEQ1Hn+Hvw2EaAjqU3PLJeisELIHR8tuLOQgYaLjt4Z1REAxPpuHtr2EeAjaQ2fLNeSUGKHzJ8N2QQgkWYLHq6qZZFgpDmd7zyHEpBjJ+zPDajTkIGGvB7eCqUSgNQ5zj8D9/6g==')
    defaultAlarm.play().catch(e => console.error('デフォルト音再生エラー:', e))
  }, [recordings])

  // アラームをチェックする
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      const activeAlarm = alarms.find(alarm =>
        alarm.isActive &&
        alarm.time === currentTime &&
        (!currentAlarm || currentAlarm.id !== alarm.id)
      )

      if (activeAlarm) {
        setCurrentAlarm(activeAlarm)
        playAlarmVoice(activeAlarm)
      }
    }

    const interval = setInterval(checkAlarms, 1000) // 1秒ごとにチェック
    return () => clearInterval(interval)
  }, [alarms, currentAlarm, playAlarmVoice])

  const addAlarm = () => {
    if (!newAlarmTime) {
      alert('時間を設定してください')
      return
    }

    const selectedRecording = recordings.find(r => r.id === selectedVoiceId)
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      time: newAlarmTime,
      isActive: true,
      selectedVoiceId: selectedVoiceId || null,
      voiceName: selectedRecording?.name || 'デフォルト音',
      createdAt: new Date()
    }

    const updatedAlarms = [...alarms, newAlarm]
    setAlarms(updatedAlarms)
    localStorage.setItem('alarms', JSON.stringify(updatedAlarms))
    
    setNewAlarmTime('')
    setSelectedVoiceId('')
  }

  const toggleAlarm = (id: string) => {
    const updatedAlarms = alarms.map(alarm =>
      alarm.id === id ? { ...alarm, isActive: !alarm.isActive } : alarm
    )
    setAlarms(updatedAlarms)
    localStorage.setItem('alarms', JSON.stringify(updatedAlarms))
  }

  const deleteAlarm = (id: string) => {
    const updatedAlarms = alarms.filter(alarm => alarm.id !== id)
    setAlarms(updatedAlarms)
    localStorage.setItem('alarms', JSON.stringify(updatedAlarms))
  }

  const stopCurrentAlarm = () => {
    setCurrentAlarm(null)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* アラーム作成 */}
      <Card>
        <CardHeader>
          <CardTitle>新しいアラームを設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="alarm-time">時間</Label>
            <Input
              id="alarm-time"
              type="time"
              value={newAlarmTime}
              onChange={(e) => setNewAlarmTime(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="voice-select">音声メッセージ</Label>
            <select
              id="voice-select"
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">デフォルト音を使用</option>
              {recordings.map((recording) => (
                <option key={recording.id} value={recording.id}>
                  {recording.name}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={addAlarm} className="w-full">
            ⏰ アラームを追加
          </Button>
        </CardContent>
      </Card>

      {/* アラーム一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>設定済みアラーム</CardTitle>
        </CardHeader>
        <CardContent>
          {alarms.length === 0 ? (
            <p className="text-gray-500 text-center">アラームが設定されていません</p>
          ) : (
            <div className="space-y-3">
              {alarms.map((alarm) => (
                <div key={alarm.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="text-lg font-semibold">{alarm.time}</div>
                    <div className="text-sm text-gray-600">{alarm.voiceName}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => toggleAlarm(alarm.id)}
                      variant={alarm.isActive ? "default" : "secondary"}
                    >
                      {alarm.isActive ? "🔔 ON" : "🔕 OFF"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteAlarm(alarm.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* アラーム通知 */}
      {currentAlarm && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="text-center p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-2">⏰ アラーム！</h2>
            <p className="text-lg mb-4">{currentAlarm.time}</p>
            <p className="mb-4">{currentAlarm.voiceName}</p>
            <Button onClick={stopCurrentAlarm} className="bg-red-600 hover:bg-red-700">
              アラームを停止
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}