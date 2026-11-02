/* Server-only Waffo helper. Never import this from a client component —
   the private key must stay on the server. */

import { WaffoPancake } from '@waffo/pancake-ts';

let cached: WaffoPancake | null = null;

/** Waffo subscription Product ID (PROD_xxx) for the $4.99/month plan. */
export const WAFFO_PRODUCT_ID = (process.env.WAFFO_PRODUCT_ID || '').trim();

/** Store ID (STO_xxx) — used by the customer portal and webhook store check. */
export const WAFFO_STORE_ID = (process.env.WAFFO_STORE_ID || '').trim();

export const WAFFO_CURRENCY = 'USD';

export function getWaffoClient(): WaffoPancake | null {
  if (cached) return cached;
  const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
  // .env single-line PEM values keep literal \n escapes — normalize them
  const privateKey = process.env.WAFFO_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!merchantId || !privateKey) return null;
  cached = new WaffoPancake({ merchantId, privateKey });
  return cached;
}

/** Names of the environment variables that still need to be configured. */
export function getMissingWaffoConfig(options: { product?: boolean; store?: boolean } = {}): string[] {
  const { product = true, store = false } = options;
  const missing: string[] = [];
  if (!process.env.WAFFO_MERCHANT_ID?.trim()) missing.push('WAFFO_MERCHANT_ID');
  if (!process.env.WAFFO_PRIVATE_KEY?.trim()) missing.push('WAFFO_PRIVATE_KEY');
  if (product && !WAFFO_PRODUCT_ID) missing.push('WAFFO_PRODUCT_ID');
  if (store && !WAFFO_STORE_ID) missing.push('WAFFO_STORE_ID');
  return missing;
}
