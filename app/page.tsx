'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const [productDescription, setProductDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productDescription.trim()) {
      setError('Please enter a product description')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productDescription }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.error || 'Failed to create conversation'
        const details = data.details ? `: ${data.details}` : ''
        throw new Error(`${errorMsg}${details}`)
      }

      const data = await response.json()
      // Handle both response formats: { id } or { conversation: { id } }
      const conversationId = data.id || data.conversation?.id
      if (!conversationId) {
        throw new Error('Invalid response from server')
      }
      router.push(`/chat/${conversationId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Copy Helper
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Generate and evaluate marketing angles for your products
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-8 animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="product" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Description
                </label>
                <textarea
                  id="product"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe your product here... e.g., 'A mobile app that helps users track their daily water intake with reminders and gamification features'"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  rows={6}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isLoading ? 'Creating...' : 'Generate Marketing Angles'}
              </button>
            </form>
          </div>

          {/* Browse Link */}
          <div className="text-center">
            <Link
              href="/browse"
              className="inline-block text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
            >
              Browse Previous Conversations →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
