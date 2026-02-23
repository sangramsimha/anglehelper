import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { productDescription } = await request.json()

    if (!productDescription || typeof productDescription !== 'string') {
      return NextResponse.json(
        { error: 'Product description is required' },
        { status: 400 }
      )
    }

    // Validate database connection
    if (!prisma) {
      console.error('Prisma client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    // Create conversation with error handling for prepared statement conflicts
    let conversation
    try {
      conversation = await prisma.conversation.create({
        data: {
          productDescription: productDescription.trim(),
        },
      })
    } catch (createError: any) {
      // If we get a prepared statement error, retry once
      if (createError?.message?.includes('prepared statement') || createError?.code === '42P05') {
        console.log('Retrying after prepared statement error...')
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100))
        conversation = await prisma.conversation.create({
          data: {
            productDescription: productDescription.trim(),
          },
        })
      } else {
        throw createError
      }
    }

    return NextResponse.json({ id: conversation.id })
  } catch (error: any) {
    console.error('Error creating conversation:', error)
    
    // Return more specific error message based on error type
    let errorMessage = 'Failed to create conversation'
    
    if (error?.code === 'P1001') {
      errorMessage = 'Database connection failed. Please check your database connection.'
    } else if (error?.code === 'P2002') {
      errorMessage = 'A conversation with this description already exists.'
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        productDescription: true,
        createdAt: true,
      },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
