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
    setIsLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'generate',
        }),
      })

      if (!response.ok) throw new Error('Failed to generate')
      const data = await response.json()
      await fetchConversation()
    } catch (error) {
      console.error('Error generating angles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEvaluate = async (ideaId: string) => {
    setEvaluatingId(ideaId)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'evaluate',
          ideaId,
        }),
      })

      if (!response.ok) throw new Error('Failed to evaluate')
      await fetchConversation()
      setEvaluatedCount(prev => prev + 1)
    } catch (error) {
      console.error('Error evaluating idea:', error)
    } finally {
      setEvaluatingId(null)
    }
  }

  const handleEvaluateAll = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'evaluate_all',
        }),
      })

      if (!response.ok) throw new Error('Failed to evaluate all ideas')
      await fetchConversation()
      // Update evaluated count to match all ideas
      const updatedData = await fetch(`/api/conversations/${conversationId}`).then(r => r.json())
      setEvaluatedCount(updatedData.ideas?.filter((i: Idea) => i.evaluations?.length > 0).length || 0)
    } catch (error) {
      console.error('Error evaluating all ideas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateFinal = async () => {
    setIsLoading(true)
    try {
      const evaluatedIdeas = ideas
        .filter(i => i.evaluations?.length > 0)
        .map(i => i.content)
      const evaluations = ideas
        .filter(i => i.evaluations?.length > 0)
        .map(i => i.evaluations[0].notes || '')

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

      if (!response.ok) throw new Error('Failed to generate final angles')
      await fetchConversation()
    } catch (error) {
      console.error('Error generating final angles:', error)
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
                <button
                  onClick={handleEvaluateAll}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 font-medium"
                >
                  {isLoading ? 'Evaluating All...' : `Evaluate All (${ideas.length - evaluatedCount} remaining)`}
                </button>
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
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">Evaluation:</span>
                          {evaluation.overallScore && (
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">
                              {evaluation.overallScore.toFixed(1)}/10
                            </span>
                          )}
                        </div>
                        <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300">
                          <ReactMarkdown>{evaluation.notes || ''}</ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEvaluate(idea.id)}
                          disabled={evaluatingId === idea.id || isLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {evaluatingId === idea.id ? 'Evaluating...' : 'Evaluate'}
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
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate Marketing Angles'}
            </button>
          ) : allEvaluated ? (
            <button
              onClick={handleGenerateFinal}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isLoading ? 'Generating...' : 'Generate 3 Final Chosen Angles'}
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
