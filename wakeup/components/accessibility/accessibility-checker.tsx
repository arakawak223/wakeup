'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Eye, Keyboard, Volume2, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: 'keyboard' | 'screen-reader' | 'visual' | 'audio' | 'general'
  title: string
  description: string
  element?: string
  suggestion: string
}

interface AccessibilityScore {
  overall: number
  keyboard: number
  screenReader: number
  visual: number
  audio: number
}

export function AccessibilityChecker() {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([])
  const [score, setScore] = useState<AccessibilityScore>({
    overall: 0,
    keyboard: 0,
    screenReader: 0,
    visual: 0,
    audio: 0
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Auto-run analysis on component mount
    runAccessibilityAnalysis()
  }, [])

  const runAccessibilityAnalysis = async () => {
    setIsAnalyzing(true)
    setIssues([])

    try {
      const detectedIssues = await analyzeAccessibility()
      setIssues(detectedIssues)
      setScore(calculateScore(detectedIssues))
    } catch (error) {
      console.error('Accessibility analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeAccessibility = async (): Promise<AccessibilityIssue[]> => {
    const issues: AccessibilityIssue[] = []

    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check for missing alt attributes
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])')
    imagesWithoutAlt.forEach((img, index) => {
      issues.push({
        id: `img-alt-${index}`,
        type: 'error',
        category: 'screen-reader',
        title: 'Missing Alt Text',
        description: '画像にalt属性がありません',
        element: `img[src="${(img as HTMLImageElement).src}"]`,
        suggestion: '画像に適切なalt属性を追加してください'
      })
    })

    // Check for missing form labels
    const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
    Array.from(inputsWithoutLabels).forEach((input, index) => {
      if (!document.querySelector(`label[for="${input.id}"]`)) {
        issues.push({
          id: `input-label-${index}`,
          type: 'error',
          category: 'screen-reader',
          title: 'Missing Form Label',
          description: 'フォーム要素にラベルがありません',
          element: `input[type="${(input as HTMLInputElement).type}"]`,
          suggestion: 'ラベル要素またはaria-labelを追加してください'
        })
      }
    })

    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    let prevLevel = 0
    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.substring(1))
      if (currentLevel - prevLevel > 1) {
        issues.push({
          id: `heading-hierarchy-${index}`,
          type: 'warning',
          category: 'screen-reader',
          title: 'Improper Heading Hierarchy',
          description: '見出しの階層が適切ではありません',
          element: heading.tagName.toLowerCase(),
          suggestion: '見出しレベルを段階的に設定してください'
        })
      }
      prevLevel = currentLevel
    })

    // Check for keyboard accessibility
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusableElements.forEach((element, index) => {
      if (!element.getAttribute('tabindex') &&
          !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
        issues.push({
          id: `keyboard-focus-${index}`,
          type: 'info',
          category: 'keyboard',
          title: 'Potential Focus Issue',
          description: 'キーボードフォーカスの問題の可能性があります',
          element: element.tagName.toLowerCase(),
          suggestion: '適切なtabindex属性を設定してください'
        })
      }
    })

    // Check for color contrast (simplified check)
    const buttons = document.querySelectorAll('button')
    buttons.forEach((button, index) => {
      const styles = window.getComputedStyle(button)
      const bgColor = styles.backgroundColor
      const textColor = styles.color

      if (bgColor === textColor || (!bgColor && !textColor)) {
        issues.push({
          id: `color-contrast-${index}`,
          type: 'warning',
          category: 'visual',
          title: 'Potential Color Contrast Issue',
          description: 'カラーコントラストが不十分な可能性があります',
          element: 'button',
          suggestion: 'WCAG 2.1のカラーコントラスト基準を満たすようにしてください'
        })
      }
    })

    // Check for audio controls
    const audioElements = document.querySelectorAll('audio, video')
    audioElements.forEach((media, index) => {
      if (!media.hasAttribute('controls') && !media.closest('[role="application"]')) {
        issues.push({
          id: `media-controls-${index}`,
          type: 'error',
          category: 'audio',
          title: 'Missing Media Controls',
          description: 'メディア要素にコントロールがありません',
          element: media.tagName.toLowerCase(),
          suggestion: 'キーボードでアクセス可能なメディアコントロールを提供してください'
        })
      }
    })

    // Check for ARIA landmarks
    const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer')
    if (landmarks.length === 0) {
      issues.push({
        id: 'missing-landmarks',
        type: 'warning',
        category: 'screen-reader',
        title: 'Missing ARIA Landmarks',
        description: 'ARIAランドマークが不足しています',
        element: 'document structure',
        suggestion: 'main, nav, header, footerまたは適切なrole属性を追加してください'
      })
    }

    return issues
  }

  const calculateScore = (issues: AccessibilityIssue[]): AccessibilityScore => {
    const maxScore = 100
    const errorWeight = 15
    const warningWeight = 5
    const infoWeight = 1

    const totalDeductions = issues.reduce((total, issue) => {
      switch (issue.type) {
        case 'error': return total + errorWeight
        case 'warning': return total + warningWeight
        case 'info': return total + infoWeight
        default: return total
      }
    }, 0)

    const overallScore = Math.max(0, maxScore - totalDeductions)

    const categoryScores = {
      keyboard: calculateCategoryScore(issues.filter(i => i.category === 'keyboard')),
      screenReader: calculateCategoryScore(issues.filter(i => i.category === 'screen-reader')),
      visual: calculateCategoryScore(issues.filter(i => i.category === 'visual')),
      audio: calculateCategoryScore(issues.filter(i => i.category === 'audio'))
    }

    return {
      overall: overallScore,
      ...categoryScores
    }
  }

  const calculateCategoryScore = (categoryIssues: AccessibilityIssue[]): number => {
    if (categoryIssues.length === 0) return 100

    const errorCount = categoryIssues.filter(i => i.type === 'error').length
    const warningCount = categoryIssues.filter(i => i.type === 'warning').length
    const infoCount = categoryIssues.filter(i => i.type === 'info').length

    const deductions = errorCount * 20 + warningCount * 10 + infoCount * 2
    return Math.max(0, 100 - deductions)
  }

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return '優秀'
    if (score >= 70) return '良好'
    if (score >= 50) return '改善必要'
    return '要修正'
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'keyboard': return <Keyboard className="h-4 w-4" />
      case 'screen-reader': return <Volume2 className="h-4 w-4" />
      case 'visual': return <Eye className="h-4 w-4" />
      case 'audio': return <Volume2 className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  const issuesByType = {
    error: issues.filter(i => i.type === 'error'),
    warning: issues.filter(i => i.type === 'warning'),
    info: issues.filter(i => i.type === 'info')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>アクセシビリティチェック</span>
            </CardTitle>
            <Button
              onClick={runAccessibilityAnalysis}
              disabled={isAnalyzing}
              size="sm"
            >
              {isAnalyzing ? '分析中...' : '再分析'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
              {score.overall}%
            </div>
            <div className="text-lg text-gray-600">
              総合スコア - {getScoreLabel(score.overall)}
            </div>
          </div>

          {/* Category Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'keyboard', label: 'キーボード', icon: <Keyboard className="h-4 w-4" /> },
              { key: 'screenReader', label: 'スクリーンリーダー', icon: <Volume2 className="h-4 w-4" /> },
              { key: 'visual', label: '視覚', icon: <Eye className="h-4 w-4" /> },
              { key: 'audio', label: '音声', icon: <Volume2 className="h-4 w-4" /> }
            ].map(({ key, label, icon }) => (
              <div key={key} className="text-center p-3 border rounded-lg">
                <div className="flex justify-center mb-2">{icon}</div>
                <div className={`text-2xl font-semibold ${getScoreColor(score[key as keyof AccessibilityScore])}`}>
                  {score[key as keyof AccessibilityScore]}%
                </div>
                <div className="text-sm text-gray-600">{label}</div>
              </div>
            ))}
          </div>

          {/* Issue Summary */}
          <div className="flex justify-center space-x-6">
            <Badge variant="destructive" className="space-x-1">
              <XCircle className="h-3 w-3" />
              <span>エラー: {issuesByType.error.length}</span>
            </Badge>
            <Badge variant="secondary" className="space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>警告: {issuesByType.warning.length}</span>
            </Badge>
            <Badge variant="outline" className="space-x-1">
              <CheckCircle className="h-3 w-3" />
              <span>情報: {issuesByType.info.length}</span>
            </Badge>
          </div>

          {/* Toggle Details */}
          {issues.length > 0 && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
                aria-controls="accessibility-details"
              >
                {showDetails ? '詳細を非表示' : '詳細を表示'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Issues */}
      {showDetails && (
        <div id="accessibility-details" className="space-y-4">
          {Object.entries(issuesByType).map(([type, typeIssues]) => (
            typeIssues.length > 0 && (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 capitalize">
                    {getIssueIcon(type)}
                    <span>
                      {type === 'error' ? 'エラー' : type === 'warning' ? '警告' : '情報'}
                      ({typeIssues.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {typeIssues.map((issue) => (
                      <Alert key={issue.id} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                        <div className="flex items-start space-x-2">
                          {getCategoryIcon(issue.category)}
                          <div className="flex-1">
                            <div className="font-medium">{issue.title}</div>
                            <AlertDescription className="mt-1">
                              {issue.description}
                              {issue.element && (
                                <div className="mt-1">
                                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                                    {issue.element}
                                  </code>
                                </div>
                              )}
                              <div className="mt-2 text-sm font-medium text-blue-700">
                                💡 {issue.suggestion}
                              </div>
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}

          {issues.length === 0 && !isAnalyzing && (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-700 mb-2">
                  アクセシビリティ問題は検出されませんでした！
                </h3>
                <p className="text-gray-600">
                  このページは基本的なアクセシビリティ要件を満たしています。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}