# Easier — AI Study Companion

Convert your study materials into summaries, flashcards, audio lessons and visual maps. Built with Next.js 15, Supabase, and OpenRouter.

## Features

- **User Authentication** - Sign up/sign in with Supabase Auth
- **Document Upload** - Support for PDF, DOCX, TXT files (up to 70 pages)
- **Smart Summaries** - Comprehensive, bullet points, or legal/key terms modes
- **Personalized** - Summaries, flashcards and visual maps tailored to each document
- **Library Management** - Save and organize all your study sets
- **Homework Solver** - Paste a question or upload a photo and get a step-by-step solution via OpenRouter
- **Flashcards & Quiz** - Coming soon with AI generation via OpenRouter
- **Audio Tutor** - Text-to-speech for summaries
- **Visual Maps** - Mind maps, timelines, and process flows

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase
- **AI**: OpenRouter API
- **File Processing**: pdf.js, mammoth
- **UI Components**: Lucide React, Sonner (toasts)

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

The homework solver requires `OPENROUTER_API_KEY`. Without it the page still loads but shows a "not configured" message. `OPENROUTER_MODEL` is optional and must point to a vision-capable model.

### 3. Set up Supabase

Create a new Supabase project and run the SQL from the README to create tables.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
