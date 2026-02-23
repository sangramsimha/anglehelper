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
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Ideas List */}
        {hasGeneratedIdeas && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Generated Ideas</h2>
            <div className="space-y-4">
              {ideas.map((idea) => {
                const evaluation = idea.evaluations?.[0]
                return (
                  <div
                    key={idea.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <p className="mb-3">{idea.content}</p>
                    {evaluation ? (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">Evaluation:</span>
                          {evaluation.overallScore && (
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              {evaluation.overallScore}/10
                            </span>
                          )}
                        </div>
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown>{evaluation.notes || ''}</ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEvaluate(idea.id)}
                        disabled={evaluatingId === idea.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {evaluatingId === idea.id ? 'Evaluating...' : 'Evaluate'}
                      </button>
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
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate 2 Final High-Potential Angles'}
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
