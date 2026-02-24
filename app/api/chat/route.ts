import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { getAngleGenerationPrompt, getEvaluationPrompt, getPostEvaluationAnglePrompt } from '@/lib/ai-prompts'

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: apiKey.trim(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, action, ideaId, evaluatedIdeas, evaluations } = body

    console.log('Chat API called with:', { action, conversationId, ideaId })

    if (!conversationId) {
      console.error('Missing conversationId')
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    // Get OpenAI client
    let openai: OpenAI
    try {
      openai = getOpenAIClient()
    } catch (error) {
      console.error('OpenAI client initialization error:', error)
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // Get conversation
    let conversation
    try {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      })
    } catch (dbError) {
      console.error('Database error fetching conversation:', dbError)
      return NextResponse.json(
        { error: 'Database error: Failed to fetch conversation' },
        { status: 500 }
      )
    }

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (action === 'generate') {
      console.log('Generating angles for conversation:', conversationId)
      try {
        // Generate marketing angles
        const prompt = getAngleGenerationPrompt(conversation.productDescription)
        console.log('Prompt generated, calling OpenAI...')
        
        // Use timeout to prevent 504 errors - Netlify functions have ~10-26 second limits
        const completion = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are an expert copywriter specializing in marketing angles and advertising ideas.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 2000, // Limit tokens to speed up response
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout: OpenAI API took too long to respond')), 20000)
          )
        ]) as any

        const content = completion.choices[0]?.message?.content || 'No response generated'
        console.log('OpenAI response received, length:', content.length)

        // Save assistant message
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content,
            messageType: 'idea_generation',
          },
        })
        console.log('Message saved to database')

        // Extract and save ideas (improved extraction for structured format)
        // Handle format like: "1. Angle: "..."\nExplanation: ...\nFramework: ..."
        
        let ideasExtracted = 0
        
        try {
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
        } catch (extractError) {
          console.error('Error extracting ideas:', extractError)
          // Continue even if extraction fails - at least the message is saved
        }

        return NextResponse.json({ content, ideasExtracted })

        return NextResponse.json({ content, ideasExtracted })
      } catch (generateError: any) {
        console.error('Error in generate action:', generateError)
        
        // Handle OpenAI API errors specifically
        if (generateError?.status === 429 || generateError?.message?.includes('quota') || generateError?.message?.includes('billing')) {
          return NextResponse.json(
            { 
              error: 'OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits. The error message was: ' + (generateError?.message || 'Quota exceeded')
            },
            { status: 429 }
          )
        }
        
        throw generateError
      }
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
        // Use timeout to prevent 504 errors
        const completion = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula. Always provide comprehensive evaluations covering Primary Promise, Unique Mechanism, and Intellectually Interesting components.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1500, // Limit tokens to speed up response
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout: OpenAI API took too long to respond')), 20000)
          )
        ]) as any

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
      } catch (openaiError: any) {
        console.error('OpenAI API error:', openaiError)
        
        // Handle OpenAI API errors specifically
        if (openaiError?.status === 429 || openaiError?.message?.includes('quota') || openaiError?.message?.includes('billing')) {
          return NextResponse.json(
            { 
              error: 'OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits. The error message was: ' + (openaiError?.message || 'Quota exceeded')
            },
            { status: 429 }
          )
        }
        
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
      const startTime = Date.now()
      const MAX_BATCH_TIME = 20000 // 20 seconds max for entire batch
      
      for (let i = 0; i < unevaluatedIdeas.length; i++) {
        // Check if we're running out of time
        const elapsed = Date.now() - startTime
        if (elapsed > MAX_BATCH_TIME) {
          console.log(`Batch evaluation timeout after ${elapsed}ms, processed ${i}/${unevaluatedIdeas.length} ideas`)
          // Return partial results
          return NextResponse.json({
            success: true,
            evaluations,
            count: evaluations.length,
            partial: true,
            message: `Partially completed: Evaluated ${evaluations.length} of ${unevaluatedIdeas.length} ideas. Please evaluate the remaining ideas individually.`
          })
        }
        
        const idea = unevaluatedIdeas[i]
        console.log(`Evaluating idea ${i + 1}/${unevaluatedIdeas.length}:`, idea.id)
        try {
          const prompt = getEvaluationPrompt(idea.content, conversation.productDescription)

          // Use shorter timeout for batch operations (15 seconds per idea)
          const completion = await Promise.race([
            openai.chat.completions.create({
              model: 'gpt-4',
              messages: [
                { role: 'system', content: 'You are an expert marketing evaluator using the Big Marketing Idea Formula. Always provide comprehensive evaluations covering Primary Promise, Unique Mechanism, and Intellectually Interesting components.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.7,
              max_tokens: 1200, // Reduced tokens for faster batch processing
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout: OpenAI API took too long to respond')), 15000)
            )
          ]) as any

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

          // Reduced delay to speed up batch processing
          if (i < unevaluatedIdeas.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (error: any) {
          console.error(`Error evaluating idea ${idea.id}:`, error)
          
          // If it's a quota error, stop processing and return error
          if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('billing')) {
            return NextResponse.json(
              { 
                error: 'OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits. The error message was: ' + (error?.message || 'Quota exceeded')
              },
              { status: 429 }
            )
          }
          
          // If it's a timeout, return partial results
          if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
            console.log(`Timeout during batch evaluation, processed ${i}/${unevaluatedIdeas.length} ideas`)
            return NextResponse.json({
              success: true,
              evaluations,
              count: evaluations.length,
              partial: true,
              message: `Partially completed: Evaluated ${evaluations.length} of ${unevaluatedIdeas.length} ideas before timeout. Please evaluate the remaining ideas individually.`
            })
          }
          
          // Continue with other ideas even if one fails
        }
      }

      // Generate final angles after all evaluations (only if all were completed)
      if (evaluations.length > 0 && evaluations.length === unevaluatedIdeas.length) {
        try {
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

          // Use timeout to prevent 504 errors
          const finalAnglesCompletion = await Promise.race([
            openai.chat.completions.create({
              model: 'gpt-4',
              messages: [
                { role: 'system', content: 'You are an expert copywriter generating high-potential marketing angles.' },
                { role: 'user', content: finalAnglesPrompt },
              ],
              temperature: 0.9,
              max_tokens: 1500, // Limit tokens to speed up response
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout: OpenAI API took too long to respond')), 20000)
            )
          ]) as any
          const finalAnglesContent = finalAnglesCompletion.choices[0]?.message?.content || 'No final angles generated'

          await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: `## ✅ All Ideas Evaluated!\n\n${finalAnglesContent}`,
              messageType: 'evaluation_summary',
            },
          })
        } catch (finalError) {
          console.error('Error generating final angles:', finalError)
          // Don't fail the whole request if final angles generation fails
        }
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

      // Use timeout to prevent 504 errors
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert copywriter generating high-potential marketing angles.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 1500, // Limit tokens to speed up response
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout: OpenAI API took too long to respond')), 20000)
        )
      ]) as any

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
  } catch (error: any) {
    console.error('Error in chat API:', error)
    
    // Handle timeout errors
    if (error?.message?.includes('timeout') || error?.message?.includes('Timeout') || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { 
          error: 'Request timed out. The OpenAI API is taking too long to respond. This may happen during high traffic. Please try again in a moment.'
        },
        { status: 504 }
      )
    }
    
    // Handle OpenAI quota/billing errors
    if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('billing') || error?.message?.includes('exceeded')) {
      return NextResponse.json(
        { 
          error: 'OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits at https://platform.openai.com/account/billing. The error message was: ' + (error?.message || 'Quota exceeded')
        },
        { status: 429 }
      )
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log full error details for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    })
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
