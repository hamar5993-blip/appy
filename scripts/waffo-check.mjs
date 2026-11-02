/* Verifies Waffo credentials and prints the Store / Product IDs to copy into
   .env.local. Uses the official @waffo/pancake-ts client and GraphQL read API.

   Usage:
     npm run waffo:check
   (expects WAFFO_MERCHANT_ID and WAFFO_PRIVATE_KEY in .env.local) */

import { WaffoPancake, WaffoPancakeError } from '@waffo/pancake-ts';
import { loadEnvLocal } from './load-env.mjs';

loadEnvLocal();

const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
const privateKey = process.env.WAFFO_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

if (!merchantId || !privateKey) {
  console.error('Missing WAFFO_MERCHANT_ID or WAFFO_PRIVATE_KEY in .env.local.');
  process.exit(1);
}

let client;
try {
  client = new WaffoPancake({ merchantId, privateKey });
} catch (error) {
  console.error(`Could not initialize the Waffo client: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

async function query(query, variables) {
  const { data, errors } = await client.graphql.query({ query, variables });
  if (errors?.length) {
    throw new Error(errors.map((item) => item.message).filter(Boolean).join(' · '));
  }
  return data;
}

function usdPrice(product) {
  const usd = product.prices?.find?.((price) => price.currency === 'USD') ??
    product.prices?.USD ??
    product.prices?.usd;
  return usd?.priceInfo?.amount ?? usd?.amount ?? '?';
}

function isTargetPrice(product) {
  const amount = usdPrice(product);
  return amount !== '?' && Number(amount) === 4.99;
}

try {
  const { stores = [] } = await query(`query {
    stores { id name status }
  }`);

  if (!stores.length) {
    console.log('Credentials work, but this merchant has no stores yet. Create one in the Pancake dashboard, then run this again.');
    process.exit(0);
  }

  const allProducts = [];
  for (const store of stores) {
    console.log(`\nStore: ${store.name} (${store.id}) — ${store.status}`);

    const { subscriptionProducts = [] } = await query(
      `query ($storeId: String!) {
        subscriptionProducts(storeId: $storeId) {
          id
          name
          billingPeriod
          status
          prices { currency priceInfo { amount taxCategory } }
          metadata
        }
      }`,
      { storeId: store.id }
    );

    if (!subscriptionProducts.length) {
      console.log('  No subscription products. Run "npm run waffo:setup" to create the $4.99/month plan.');
    }

    for (const product of subscriptionProducts) {
      allProducts.push({ ...product, storeId: store.id });
      const current = product.id === process.env.WAFFO_PRODUCT_ID ? '  ← configured' : '';
      console.log(
        `  ${product.name} (${product.id}) — ${product.billingPeriod}, $${usdPrice(product)} USD, ${product.status}${current}`
      );
    }

    try {
      const { store: detail } = await query(
        `query ($id: ID!) {
          store(id: $id) {
            storeWebhooks { id channel url events testMode }
          }
        }`,
        { id: store.id }
      );
      const webhooks = detail?.storeWebhooks ?? [];
      if (webhooks.length) {
        console.log('  Webhooks:');
        const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/+$/, '');
        const appWebhook = origin ? `${origin}/api/webhooks/waffo` : '';
        for (const webhook of webhooks) {
          const target = appWebhook && webhook.url === appWebhook ? '  ← app endpoint' : '';
          console.log(
            `    ${webhook.channel} ${webhook.testMode ? '[test]' : '[prod]'} ${webhook.url} (${webhook.events?.length ?? 0} events)${target}`
          );
        }
      }
    } catch (error) {
      // Older API keys may not expose the webhook list over GraphQL. The
      // credentials/product check above is still useful in that case.
      console.log(`  Webhook list unavailable: ${error instanceof Error ? error.message : error}`);
    }
  }

  const configuredProduct = allProducts.find((item) => item.id === process.env.WAFFO_PRODUCT_ID);
  const storeId = process.env.WAFFO_STORE_ID || configuredProduct?.storeId || stores[0]?.id;
  const product =
    configuredProduct ??
    allProducts.find(
      (item) => item.storeId === storeId && item.billingPeriod === 'monthly' && isTargetPrice(item)
    ) ??
    allProducts.find((item) => item.billingPeriod === 'monthly' && isTargetPrice(item)) ??
    allProducts[0];

  console.log('\nEnvironment values:');
  console.log(`WAFFO_MERCHANT_ID=${merchantId}`);
  console.log(`WAFFO_STORE_ID=${storeId ?? ''}`);
  console.log(`WAFFO_PRODUCT_ID=${product?.id ?? ''}`);
  console.log('WAFFO_PRIVATE_KEY=<keep your existing key>');
} catch (error) {
  if (error instanceof WaffoPancakeError) {
    console.error(`Waffo error ${error.status}:`);
    for (const item of error.errors ?? []) console.error(`  - ${item.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
}
