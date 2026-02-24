import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { getAngleGenerationPrompt, getEvaluationPrompt, getPostEvaluationAnglePrompt } from '@/lib/ai-prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, action, ideaId, evaluatedIdeas, evaluations } = body

    console.log('Chat API called with:', { action, conversationId, ideaId })

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured')
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    if (!conversationId) {
      console.error('Missing conversationId')
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
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

      // Extract and save ideas (improved extraction for structured format)
      // Handle format like: "1. Angle: "..."\nExplanation: ...\nFramework: ..."
      
      let ideasExtracted = 0
      
      // Method 1: Try structured format with "Angle:" label
      const anglePattern = /\d+[\.\)]\s*Angle[:\s]+["']?([^"'\n]+)["']?/gi
      let match
      while ((match = anglePattern.exec(content)) !== null) {
        let ideaText = match[1]
          .replace(/^["']|["']$/g, '')
          .trim()
        
        if (ideaText.length > 10 && ideaText.length < 300) {
          try {
            await prisma.idea.create({
              data: {
                conversationId,
                content: ideaText,
              },
            })
            ideasExtracted++
          } catch (error) {
            console.error('Error saving idea:', error)
          }
        }
      }
      
      // Method 2: If no ideas extracted, try simple numbered list
      if (ideasExtracted === 0) {
        const simplePattern = /\d+[\.\)]\s*(.+?)(?=\n\s*\d+[\.\)]|$)/gms
        const simpleMatches = content.match(simplePattern)
        
        if (simpleMatches) {
          for (const match of simpleMatches) {
            let ideaText = match
              .replace(/^\d+[\.\)]\s*/, '')
              .replace(/^Angle[:\s]+/i, '')
              .replace(/["']/g, '')
              .split('\n')[0]
              .trim()
            
            // Skip if it looks like it's part of Explanation or Framework
            if (ideaText.toLowerCase().startsWith('explanation') || 
                ideaText.toLowerCase().startsWith('framework')) {
              continue
            }
            
            if (ideaText.length > 10 && ideaText.length < 300) {
              try {
                await prisma.idea.create({
                  data: {
                    conversationId,
                    content: ideaText,
                  },
                })
                ideasExtracted++
              } catch (error) {
                console.error('Error saving idea:', error)
              }
            }
          }
        }
      }
      
      console.log(`Extracted ${ideasExtracted} ideas from content`)

      return NextResponse.json({ content })
    }

    if (action === 'evaluate' && ideaId) {
      console.log('Evaluating idea:', ideaId)
      // Evaluate a specific idea
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
      })

      if (!idea) {
        console.error('Idea not found:', ideaId)
        return NextResponse.json(
          { error: 'Idea not found' },
          { status: 404 }
        )
      }

      console.log('Idea found, generating evaluation...')
      const prompt = getEvaluationPrompt(idea.content, conversation.productDescription)

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula. Always provide comprehensive evaluations covering Primary Promise, Unique Mechanism, and Intellectually Interesting components.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        })

        const content = completion.choices[0]?.message?.content || 'No evaluation generated'
        console.log('Evaluation generated, length:', content.length)

        // Extract score (try multiple patterns)
        const scoreMatch = content.match(/(?:Overall Rating|Rating|Score|overall rating)[:\s]*(\d+(?:\.\d+)?)\s*(?:out of|\/)?\s*10/i) ||
                          content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i)
        const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : null
        console.log('Extracted score:', overallScore)

        // Save evaluation
        const evaluation = await prisma.evaluation.create({
          data: {
            ideaId,
            overallScore,
            notes: content,
          },
        })
        console.log('Evaluation saved:', evaluation.id)

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
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError)
        throw openaiError
      }
    }

    if (action === 'evaluate_all') {
      console.log('Evaluating all ideas for conversation:', conversationId)
      // Evaluate all ideas at once
      const ideas = await prisma.idea.findMany({
        where: { conversationId },
        include: { evaluations: true },
      })

      console.log('Total ideas found:', ideas.length)
      const unevaluatedIdeas = ideas.filter(idea => idea.evaluations.length === 0)
      console.log('Unevaluated ideas:', unevaluatedIdeas.length)

      if (unevaluatedIdeas.length === 0) {
        return NextResponse.json(
          { error: 'All ideas have already been evaluated' },
          { status: 400 }
        )
      }

      const evaluations = []
      for (let i = 0; i < unevaluatedIdeas.length; i++) {
        const idea = unevaluatedIdeas[i]
        console.log(`Evaluating idea ${i + 1}/${unevaluatedIdeas.length}:`, idea.id)
        try {
          const prompt = getEvaluationPrompt(idea.content, conversation.productDescription)

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula. Always provide comprehensive evaluations covering Primary Promise, Unique Mechanism, and Intellectually Interesting components.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          })

          const content = completion.choices[0]?.message?.content || 'No evaluation generated'

          // Extract score (try multiple patterns)
          const scoreMatch = content.match(/(?:Overall Rating|Rating|Score|overall rating)[:\s]*(\d+(?:\.\d+)?)\s*(?:out of|\/)?\s*10/i) ||
                            content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i)
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

          console.log(`Completed evaluation ${i + 1}/${unevaluatedIdeas.length}`)

          // Add a small delay to avoid rate limits
          if (i < unevaluatedIdeas.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Error evaluating idea ${idea.id}:`, error)
          // Continue with other ideas even if one fails
        }
      }

      // Generate final angles after all evaluations
      if (evaluations.length > 0) {
        const allIdeas = await prisma.idea.findMany({
          where: { conversationId },
          include: { evaluations: true },
        })
        const allIdeaContents = allIdeas.map(i => i.content)
        const allEvaluationNotes = allIdeas.flatMap(i => i.evaluations.map(e => e.notes || ''))

        const finalAnglesPrompt = getPostEvaluationAnglePrompt(
          allIdeaContents,
          allEvaluationNotes,
          conversation.productDescription
        )

        const finalAnglesCompletion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert copywriter generating high-potential marketing angles.' },
            { role: 'user', content: finalAnglesPrompt },
          ],
          temperature: 0.9,
        })
        const finalAnglesContent = finalAnglesCompletion.choices[0]?.message?.content || 'No final angles generated'

        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: `## ✅ All Ideas Evaluated!\n\n${finalAnglesContent}`,
            messageType: 'evaluation_summary',
          },
        })
      }

      return NextResponse.json({ 
        success: true,
        evaluations, 
        count: evaluations.length,
        message: `Successfully evaluated ${evaluations.length} ideas` 
      })
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
