'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: string
  content: string
  messageType?: string
  createdAt: string
}

interface Idea {
  id: string
  content: string
  evaluations: Array<{
    id: string
    overallScore: number | null
    notes: string | null
  }>
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const [conversation, setConversation] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null)
  const [evaluatedCount, setEvaluatedCount] = useState(0)
  const [evaluatingAll, setEvaluatingAll] = useState(false)
  const [evaluationProgress, setEvaluationProgress] = useState({ current: 0, total: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setConversation(data)
      setMessages(data.messages || [])
      setIdeas(data.ideas || [])
      setEvaluatedCount(data.ideas?.filter((i: Idea) => i.evaluations?.length > 0).length || 0)
    } catch (error) {
      console.error('Error fetching conversation:', error)
    }
  }

  const handleGenerate = async () => {
    console.log('handleGenerate called')
    setIsLoading(true)
    try {
      console.log('Sending generate request...', { conversationId, action: 'generate' })
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'generate',
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : {}
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        console.error('Error response:', errorData, 'Status:', response.status)
        throw new Error(errorData.error || `Failed to generate: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Generate successful:', data)
      await fetchConversation()
    } catch (error) {
      console.error('Error generating angles:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate angles. Please check the console for details.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEvaluate = async (ideaId: string) => {
    console.log('handleEvaluate called with ideaId:', ideaId)
    setEvaluatingId(ideaId)
    try {
      console.log('Sending evaluation request...', { conversationId, action: 'evaluate', ideaId })
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'evaluate',
          ideaId,
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : {}
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        console.error('Error response:', errorData, 'Status:', response.status)
        throw new Error(errorData.error || `Failed to evaluate: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Evaluation successful:', data)
      await fetchConversation()
      setEvaluatedCount(prev => prev + 1)
    } catch (error) {
      console.error('Error evaluating idea:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to evaluate idea. Please check the console for details.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setEvaluatingId(null)
    }
  }

  const handleEvaluateAll = async () => {
    console.log('handleEvaluateAll called')
    const unevaluatedCount = ideas.filter(i => i.evaluations?.length === 0).length
    console.log('Unevaluated count:', unevaluatedCount)
    
    if (unevaluatedCount === 0) {
      alert('All ideas have already been evaluated!')
      return
    }

    setEvaluatingAll(true)
    setEvaluationProgress({ current: 0, total: unevaluatedCount })
    setIsLoading(true)
    
    try {
      console.log('Sending evaluate_all request...', { conversationId, action: 'evaluate_all' })
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'evaluate_all',
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : {}
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        console.error('Error response:', errorData, 'Status:', response.status)
        throw new Error(errorData.error || `Failed to evaluate all ideas: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Evaluate all successful:', data)
      setEvaluationProgress({ current: data.count || unevaluatedCount, total: unevaluatedCount })
      
      // Refresh conversation data
      await fetchConversation()
      
      // Update evaluated count
      const updatedData = await fetch(`/api/conversations/${conversationId}`).then(r => r.json())
      setEvaluatedCount(updatedData.ideas?.filter((i: Idea) => i.evaluations?.length > 0).length || 0)
    } catch (error) {
      console.error('Error evaluating all ideas:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to evaluate all ideas. Please check the console for details.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
      setEvaluatingAll(false)
      setEvaluationProgress({ current: 0, total: 0 })
    }
  }

  const handleGenerateFinal = async () => {
    console.log('handleGenerateFinal called')
    setIsLoading(true)
    try {
      const evaluatedIdeas = ideas
        .filter(i => i.evaluations?.length > 0)
        .map(i => i.content)
      const evaluations = ideas
        .filter(i => i.evaluations?.length > 0)
        .map(i => i.evaluations[0].notes || '')

      console.log('Sending generate_final request...', { conversationId, action: 'generate_final', evaluatedIdeasCount: evaluatedIdeas.length })
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'generate_final',
          evaluatedIdeas,
          evaluations,
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : {}
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        console.error('Error response:', errorData, 'Status:', response.status)
        throw new Error(errorData.error || `Failed to generate final angles: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Generate final successful:', data)
      await fetchConversation()
    } catch (error) {
      console.error('Error generating final angles:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate final angles. Please check the console for details.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const hasGeneratedIdeas = ideas.length > 0
  const allEvaluated = ideas.length > 0 && evaluatedCount === ideas.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6 mb-6 sticky top-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Marketing Angle Generator
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {conversation?.productDescription}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              ← Home
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-lg'
                }`}
              >
                {message.messageType === 'evaluation' ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Ideas List */}
        {hasGeneratedIdeas && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Generated Ideas ({ideas.length})</h2>
              {evaluatedCount < ideas.length && (
                <div className="flex items-center gap-3">
                  {evaluatingAll && evaluationProgress.total > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Evaluating {evaluationProgress.current}/{evaluationProgress.total}...</span>
                    </div>
                  )}
                  <button
                    onClick={handleEvaluateAll}
                    disabled={isLoading || evaluatingAll}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 font-medium flex items-center gap-2"
                  >
                    {evaluatingAll ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      `Evaluate All (${ideas.length - evaluatedCount} remaining)`
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {ideas.map((idea, index) => {
                const evaluation = idea.evaluations?.[0]
                return (
                  <div
                    key={idea.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center font-semibold text-purple-600 dark:text-purple-400">
                        {index + 1}
                      </span>
                      <p className="flex-1 text-gray-800 dark:text-gray-200 leading-relaxed">{idea.content}</p>
                    </div>
                    {evaluation ? (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-5 border border-green-200 dark:border-green-800 mt-4">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-green-200 dark:border-green-700">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">Overall Rating:</span>
                          {evaluation.overallScore !== null ? (
                            <span className={`text-2xl font-bold ${
                              evaluation.overallScore >= 8 
                                ? 'text-green-600 dark:text-green-400' 
                                : evaluation.overallScore >= 6 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {evaluation.overallScore.toFixed(1)}/10
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                          )}
                        </div>
                        <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
                          <ReactMarkdown
                            components={{
                              h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props} />,
                              p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1 ml-4" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1 ml-4" {...props} />,
                            }}
                          >
                            {evaluation.notes || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleEvaluate(idea.id)}
                          disabled={evaluatingId === idea.id || isLoading || evaluatingAll}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                          {evaluatingId === idea.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Evaluating...</span>
                            </>
                          ) : (
                            'Evaluate'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6">
          {!hasGeneratedIdeas ? (
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Marketing Angles...</span>
                </>
              ) : (
                'Generate Marketing Angles'
              )}
            </button>
          ) : allEvaluated ? (
            <button
              onClick={handleGenerateFinal}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Final Angles...</span>
                </>
              ) : (
                'Generate 3 Final Chosen Angles'
              )}
            </button>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400">
              Evaluate all ideas to generate final angles
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
