import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Validate DATABASE_URL
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Ensure we're using direct PostgreSQL connection, not Data Proxy
if (databaseUrl.startsWith('prisma://')) {
  throw new Error('DATABASE_URL should use postgresql:// protocol, not prisma://')
}

// Configure Prisma Client for serverless environments
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  // Disable prepared statements to avoid "prepared statement already exists" error in serverless
  // This is a workaround for Netlify/serverless environments
  __internal: {
    engine: {
      connectTimeout: 60000,
    },
  },
})

// In production (serverless), don't reuse the client to avoid prepared statement conflicts
if (process.env.NODE_ENV === 'production') {
  // Disconnect after each request in serverless
  if (typeof globalThis !== 'undefined') {
    // Clean up on process exit
    process.on('beforeExit', async () => {
      await prisma.$disconnect()
    })
  }
} else {
  // In development, reuse the client
  globalForPrisma.prisma = prisma
}
