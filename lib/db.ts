import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Validate DATABASE_URL
let databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Ensure we're using direct PostgreSQL connection, not Data Proxy
if (databaseUrl.startsWith('prisma://')) {
  throw new Error('DATABASE_URL should use postgresql:// protocol, not prisma://')
}

// For Supabase connection pooler, add parameters to avoid prepared statement conflicts
if (databaseUrl.includes('.pooler.supabase.com') || databaseUrl.includes(':6543/')) {
  // Add connection parameters for pooler
  const url = new URL(databaseUrl)
  url.searchParams.set('pgbouncer', 'true')
  url.searchParams.set('connection_limit', '1')
  databaseUrl = url.toString()
}

// Configure Prisma Client for serverless environments
// Use connection pooling URL if available (Supabase pooler uses port 6543)
const isPoolerUrl = databaseUrl.includes(':6543/') || databaseUrl.includes('.pooler.supabase.com')

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

// In production (serverless), handle connection cleanup
if (process.env.NODE_ENV === 'production') {
  // Ensure we disconnect properly in serverless
  if (typeof process !== 'undefined') {
    const disconnect = async () => {
      try {
        await prisma.$disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    // Clean up on various exit signals
    process.on('SIGINT', disconnect)
    process.on('SIGTERM', disconnect)
    process.on('beforeExit', disconnect)
  }
} else {
  // In development, reuse the client
  globalForPrisma.prisma = prisma
}
