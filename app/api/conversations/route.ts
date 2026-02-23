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

    const conversation = await prisma.conversation.create({
      data: {
        productDescription: productDescription.trim(),
      },
    })

    return NextResponse.json({ id: conversation.id })
  } catch (error) {
    console.error('Error creating conversation:', error)
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
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
