import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { getAngleGenerationPrompt, getEvaluationPrompt, getPostEvaluationAnglePrompt } from '@/lib/ai-prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { conversationId, action, ideaId, evaluatedIdeas, evaluations } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (action === 'generate') {
      // Generate marketing angles
      const prompt = getAngleGenerationPrompt(conversation.productDescription)
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert copywriter specializing in marketing angles and advertising ideas.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
      })

      const content = completion.choices[0]?.message?.content || 'No response generated'

      // Save assistant message
      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
          messageType: 'idea_generation',
        },
      })

      // Extract and save ideas (improved extraction)
      // Look for numbered items with "Angle:" or similar patterns
      const anglePattern = /(?:^|\n)\s*\d+[\.\)]\s*(?:Angle[:\s]+)?(.+?)(?=\n\s*\d+[\.\)]|$)/gms
      const ideaMatches = content.match(anglePattern) || content.match(/\d+[\.\)]\s*([\s\S]+?)(?=\n\n|\d+[\.\)]|$)/gm)
      
      if (ideaMatches) {
        for (const match of ideaMatches) {
          // Clean up the match - remove numbering and "Angle:" prefix
          let ideaText = match
            .replace(/^\d+[\.\)]\s*/, '')
            .replace(/^Angle[:\s]+/i, '')
            .replace(/\n\s*(?:Explanation|Framework)[:\s].*$/is, '')
            .trim()
          
          // If it's too short or just whitespace, skip
          if (ideaText.length > 20 && ideaText.length < 500) {
            await prisma.idea.create({
              data: {
                conversationId,
                content: ideaText,
              },
            })
          }
        }
      }

      return NextResponse.json({ content })
    }

    if (action === 'evaluate' && ideaId) {
      // Evaluate a specific idea
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
      })

      if (!idea) {
        return NextResponse.json(
          { error: 'Idea not found' },
          { status: 404 }
        )
      }

      const prompt = getEvaluationPrompt(idea.content, conversation.productDescription)

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      })

      const content = completion.choices[0]?.message?.content || 'No evaluation generated'

      // Extract score (look for "1-10" or "rating" patterns)
      const scoreMatch = content.match(/(?:rating|score|overall)[:\s]*(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*10/i)
      const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : null

      // Save evaluation
      const evaluation = await prisma.evaluation.create({
        data: {
          ideaId,
          overallScore,
          notes: content,
        },
      })

      // Save assistant message
      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
          messageType: 'evaluation',
        },
      })

      return NextResponse.json({ content, evaluationId: evaluation.id, overallScore })
    }

    if (action === 'evaluate_all') {
      // Evaluate all ideas at once
      const ideas = await prisma.idea.findMany({
        where: { conversationId },
        include: { evaluations: true },
      })

      const unevaluatedIdeas = ideas.filter(idea => idea.evaluations.length === 0)

      if (unevaluatedIdeas.length === 0) {
        return NextResponse.json(
          { error: 'All ideas have already been evaluated' },
          { status: 400 }
        )
      }

      const evaluations = []
      for (const idea of unevaluatedIdeas) {
        const prompt = getEvaluationPrompt(idea.content, conversation.productDescription)

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        })

        const content = completion.choices[0]?.message?.content || 'No evaluation generated'

        // Extract score
        const scoreMatch = content.match(/(?:rating|score|overall)[:\s]*(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*10/i)
        const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : null

        // Save evaluation
        await prisma.evaluation.create({
          data: {
            ideaId: idea.id,
            overallScore,
            notes: content,
          },
        })

        evaluations.push({
          ideaId: idea.id,
          content,
          overallScore,
        })
      }

      // Save summary message
      const summaryContent = `Evaluated ${evaluations.length} ideas:\n\n${evaluations.map((e, i) => `**Idea ${i + 1}:**\n${e.content}\n`).join('\n---\n\n')}`

      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: summaryContent,
          messageType: 'evaluation',
        },
      })

      return NextResponse.json({ evaluations, count: evaluations.length })
    }

    if (action === 'generate_final' && evaluatedIdeas && evaluations) {
      // Generate final angles based on evaluations
      const prompt = getPostEvaluationAnglePrompt(
        evaluatedIdeas,
        evaluations,
        conversation.productDescription
      )

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert copywriter generating high-potential marketing angles.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
      })

      const content = completion.choices[0]?.message?.content || 'No angles generated'

      // Save assistant message
      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
          messageType: 'idea_generation',
        },
      })

      return NextResponse.json({ content })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
