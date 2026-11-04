# Easier — AI Study Companion

Convert your study materials into summaries, flashcards, audio lessons and visual maps. Built with Next.js 15, Supabase, and OpenRouter.

## Features

- **User Authentication** - Sign up/sign in with Supabase Auth
- **Document Upload** - Support for PDF, DOCX, TXT files (up to 70 pages)
- **Smart Summaries** - Comprehensive, bullet points, or legal/key terms modes
- **Personalized** - Summaries, flashcards and visual maps tailored to each document
- **Library Management** - Save and organize all your study sets
- **Homework Solver** - Paste a question or upload a photo/PDF and get a step-by-step solution via OpenRouter
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

The homework solver requires `OPENROUTER_API_KEY`. Without it the page still loads but shows a "not configured" message. `OPENROUTER_MODEL` is optional and must point to a model that accepts images and files (default: `google/gemini-3.5-flash`). Failures now surface the provider status and message in the UI and are logged on the server.

> Note: on Vercel the request body limit is about 4.5 MB, so scanned PDFs sent as base64 must stay under ~3 MB. Text PDFs are extracted in the browser and are not affected by that limit.

### 3. Set up Supabase

Create a new Supabase project and run the SQL from the README to create tables. Then run `supabase/subscriptions.sql` once in the SQL editor — it adds the subscription columns, the signup-trial trigger, and the webhook indexes.

### 4. Set up Waffo payments

The integration uses **`@waffo/pancake-ts`** for checkout, the customer portal, webhook verification, and one-time account provisioning. You do not need to create the product or webhook by hand.

1. Copy your **Merchant ID** and **Private Key** from *Dashboard → API & Development → "Create an API Key"* (the Merchant ID is shown above the key list), and your **Store ID** from *Dashboard → Settings → Store Profile*, into `.env.local` (and your host's environment variables):

```bash
WAFFO_MERCHANT_ID=MER_...
WAFFO_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WAFFO_STORE_ID=STO_...
SUPABASE_SERVICE_ROLE_KEY=...
# Public site origin used for the checkout return URL and webhook setup
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
```

2. Provision the product and webhook with the SDK:

```bash
npm run waffo:setup
```

The script finds or creates the **$4.99 USD / monthly** subscription product, publishes it, and registers `https://YOUR_DOMAIN/api/webhooks/waffo`. It is safe to run more than once: it reuses an existing product/webhook instead of creating duplicates. It prints the `WAFFO_STORE_ID` and `WAFFO_PRODUCT_ID` values to add to your environment.

Useful options:

```bash
# Register the test-mode webhook while using a Waffo test key
npm run waffo:setup -- --test

# Explicit store/product/webhook URL
npm run waffo:setup -- --store STO_... --product PROD_... --url https://YOUR_DOMAIN/api/webhooks/waffo

# Retry publishing an existing product
npm run waffo:setup -- --publish

# Skip publishing or webhook registration
npm run waffo:setup -- --no-publish --no-webhook
```

3. Verify the final configuration:

```bash
npm run waffo:check
```

It lists every store, subscription product, webhook, and the exact environment values.

4. Deploy, open **Pricing**, and start a checkout. Checkout is created in **authenticated mode** with `buyerIdentity` set to the Supabase user id, so the webhook credits the right profile even if the customer edits their email on Waffo's page. The webhook also falls back to the email for older anonymous orders.

The 1-day trial is granted in-app at signup, so checkout deliberately sends `withTrial: false` and starts the paid plan — do not enable a second trial on the Waffo product. The webhook endpoint handles:

- `order.completed`
- `subscription.activated`, `subscription.renewed`, `subscription.recovered`, `subscription.plan_changed`
- `subscription.payment_succeeded`, `subscription.canceling`, `subscription.uncanceled`
- `subscription.past_due`, `subscription.canceled`
- `refund.succeeded`

Notes:

- `WAFFO_PRIVATE_KEY` may be stored with literal `\n` sequences; the server normalizes them.
- `WAFFO_STORE_ID` is required in production: the webhook rejects signed events that belong to a different store, and the **Manage subscription** item opens Waffo's signed customer portal with it.
- Test the full flow with a Waffo **test** API key before switching to the production key. The webhook verifies both test and production signatures automatically.
- To provision a store too (only when the merchant has none), run `npm run waffo:setup -- --create-store`.

#### Checkout says "Payments are being configured on our side"

This message comes from `/api/subscribe` before Waffo is called. It means `WAFFO_MERCHANT_ID`, `WAFFO_PRIVATE_KEY`, or `WAFFO_PRODUCT_ID` is empty in the running process.

- **Local:** add the values to `.env.local` and restart `npm run dev`.
- **Vercel/other host:** add them to the project's environment variables for the correct environment, then redeploy — existing deployments do not pick up new variables.
- Run `npm run waffo:check`. If it still fails, the server log now names the exact missing variable.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
