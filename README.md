# Copy Helper - Marketing Angle Generator

A Next.js application for generating and evaluating marketing angles/ideas for products using AI.

## Features

- **Idea Generation**: Generate marketing angles using multiple frameworks (15-Step Framework, 7 Deadly Sins, Writing Great Leads)
- **Idea Evaluation**: Evaluate ideas using the "Big Marketing Idea Formula" with ratings and feedback
- **Final Angle Generation**: Generate 2 high-potential angles based on evaluation insights
- **Chat Interface**: ChatGPT-like interface for interactive idea generation
- **Browse Conversations**: View and access previous conversations

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** (PostgreSQL)
- **OpenAI API** (GPT-4)
- **Supabase** (PostgreSQL database)
- **Netlify** (Deployment)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   DATABASE_URL=postgresql://postgres:password@host:port/database
   ```

3. **Set up database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Deployment to Netlify

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Deploy to Netlify:**
   - Connect your GitHub repository
   - Set environment variables in Netlify dashboard:
     - `OPENAI_API_KEY`
     - `DATABASE_URL` (Supabase PostgreSQL connection string)
   - Deploy

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `DATABASE_URL`: PostgreSQL connection string (Supabase)

## Database Schema

- **Conversation**: Stores product descriptions and conversation metadata
- **Message**: Stores chat messages (user and assistant)
- **Idea**: Stores generated marketing angles
- **Evaluation**: Stores evaluation results for ideas
