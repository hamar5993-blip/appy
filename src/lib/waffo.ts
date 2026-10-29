/* Server-only Waffo helper. Never import this from a client component —
   the private key must stay on the server. */

import { WaffoPancake } from '@waffo/pancake-ts';

let cached: WaffoPancake | null = null;

export function getWaffoClient(): WaffoPancake | null {
  if (cached) return cached;
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  // .env single-line PEM values keep literal \n escapes — normalize them
  const privateKey = process.env.WAFFO_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!merchantId || !privateKey) return null;
  cached = new WaffoPancake({ merchantId, privateKey });
  return cached;
}

/** Waffo subscription Product ID (PROD_xxx) for the $4.99/month plan with 1-day trial. */
export const WAFFO_PRODUCT_ID = process.env.WAFFO_PRODUCT_ID || '';
