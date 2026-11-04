/* Provisions the Easier payment setup through @waffo/pancake-ts:
   - finds (or creates) the $4.99/month Easier Pro subscription product
   - publishes a newly created product so checkout can use it
   - finds (or creates) the signed webhook endpoint
   - prints the values to put in .env.local

   Usage:
     npm run waffo:setup
     npm run waffo:setup -- --url https://example.com/api/webhooks/waffo
     npm run waffo:setup -- --test
     npm run waffo:setup -- --store STO_xxx --product PROD_xxx
     npm run waffo:setup -- --publish
     npm run waffo:setup -- --no-webhook --no-publish

   Required env (from .env.local):
     WAFFO_MERCHANT_ID
     WAFFO_PRIVATE_KEY
   Optional env:
     WAFFO_STORE_ID            select a store when the merchant has several
     WAFFO_PRODUCT_ID          reuse an existing product
     WAFFO_WEBHOOK_URL         webhook target; falls back to APP_URL/api/webhooks/waffo
     WAFFO_WEBHOOK_TEST_MODE   true to register the test-mode webhook
     NEXT_PUBLIC_APP_URL       public site origin, used to build the webhook URL
     APP_URL                   fallback public site origin
*/

import {
  BillingPeriod,
  ProductVersionStatus,
  TaxCategory,
  WaffoPancake,
  WaffoPancakeError,
  WebhookEventType,
} from '@waffo/pancake-ts';
import { loadEnvLocal } from './load-env.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const PRODUCT_NAME = 'Easier Pro — Monthly';
const PRODUCT_DESCRIPTION =
  'Unlimited summaries, flashcards, mind maps, audio lessons and homework help. Billed monthly, cancel anytime.';
const PRODUCT_PRICE = '4.99';
const PRODUCT_MARKER = 'pro-monthly';

const WEBHOOK_EVENTS = [
  WebhookEventType.OrderCompleted,
  WebhookEventType.SubscriptionActivated,
  WebhookEventType.SubscriptionRenewed,
  WebhookEventType.SubscriptionRecovered,
  WebhookEventType.SubscriptionPlanChanged,
  WebhookEventType.SubscriptionPaymentSucceeded,
  WebhookEventType.SubscriptionUncanceled,
  WebhookEventType.SubscriptionCanceling,
  WebhookEventType.SubscriptionPastDue,
  WebhookEventType.SubscriptionCanceled,
  WebhookEventType.RefundSucceeded,
];

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

function metadataOf(product) {
  if (!product.metadata) return {};
  if (typeof product.metadata === 'string') {
    try {
      return JSON.parse(product.metadata);
    } catch {
      return {};
    }
  }
  return product.metadata;
}

function priceOf(product) {
  const usd = product.prices?.find?.((price) => price.currency === 'USD') ??
    product.prices?.USD ??
    product.prices?.usd;
  return usd?.priceInfo?.amount ?? usd?.amount ?? null;
}

function isTargetPrice(product) {
  const amount = priceOf(product);
  return amount !== null && Number(amount) === Number(PRODUCT_PRICE);
}

function normaliseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

async function readWebhooks(storeId) {
  const data = await query(
    `query ($id: String!) {
      store(id: $id) {
        storeWebhooks { id channel url events testMode }
      }
    }`,
    { id: storeId }
  );
  return data.store?.storeWebhooks ?? [];
}

async function main() {
  const { stores = [] } = await query(`query {
    stores { id name status }
  }`);

  let storeId = (argValue('--store') || process.env.WAFFO_STORE_ID || '').trim();
  if (!storeId) {
    if (stores.length === 1) {
      storeId = stores[0].id;
    } else if (!stores.length && hasFlag('--create-store')) {
      const { store } = await client.stores.create({ name: 'Easier' });
      storeId = store.id;
      console.log(`Created store ${store.name} (${store.id}).`);
      stores.push({ id: store.id, name: store.name, status: store.status });
    }
  }

  if (!storeId) {
    console.error(
      stores.length
        ? `Merchant has ${stores.length} stores. Pick one with --store <STO_...> or set WAFFO_STORE_ID:`
        : 'No stores found. Create one in the Pancake dashboard, or rerun with --create-store.'
    );
    for (const store of stores) console.error(`  ${store.name} (${store.id})`);
    process.exitCode = 1;
    return;
  }

  const store = stores.find((item) => item.id === storeId);
  console.log(`Store: ${store ? `${store.name} (${store.id})` : storeId}`);

  const { subscriptionProducts = [] } = await query(
    `query ($storeId: String!) {
      subscriptionProducts(storeId: $storeId) {
        id
        name
        description
        billingPeriod
        status
        prices { currency priceInfo { amount taxCategory } }
        metadata
      }
    }`,
    { storeId }
  );

  const configuredProductId = (argValue('--product') || process.env.WAFFO_PRODUCT_ID || '').trim();
  let product = configuredProductId
    ? subscriptionProducts.find((item) => item.id === configuredProductId)
    : undefined;

  if (configuredProductId && !product) {
    console.warn(`Configured product ${configuredProductId} is not in this store; searching for the plan instead.`);
  }

  product ??= subscriptionProducts.find((item) => {
    const meta = metadataOf(item);
    return meta.app === 'easier' && meta.plan === PRODUCT_MARKER;
  });
  product ??= subscriptionProducts.find((item) => item.name === PRODUCT_NAME);
  product ??= subscriptionProducts.find(
    (item) => item.billingPeriod === BillingPeriod.Monthly && isTargetPrice(item)
  );

  let created = false;
  if (product) {
    console.log(`Using product ${product.name} (${product.id}) — $${priceOf(product) ?? '?'} USD / ${product.billingPeriod}.`);
    if (product.billingPeriod !== BillingPeriod.Monthly || !isTargetPrice(product)) {
      console.warn(
        `Warning: expected a monthly $${PRODUCT_PRICE} USD product; found ${product.billingPeriod}, $${priceOf(product) ?? '?'} USD.`
      );
    }
  } else {
    const result = await client.subscriptionProducts.create({
      storeId,
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      billingPeriod: BillingPeriod.Monthly,
      prices: { USD: { amount: PRODUCT_PRICE, taxCategory: TaxCategory.SaaS } },
      metadata: { app: 'easier', plan: PRODUCT_MARKER },
    });
    product = result.product;
    created = true;
    console.log(`Created product ${product.name} (${product.id}) — $${PRODUCT_PRICE} USD / month.`);
  }

  if ((created || hasFlag('--publish')) && !hasFlag('--no-publish')) {
    try {
      const published = await client.subscriptionProducts.publish({ id: product.id });
      product = published.product ?? product;
      console.log(`Published product ${product.id} to production.`);
    } catch (error) {
      console.warn(
        `Could not publish the product automatically: ${
          error instanceof Error ? error.message : error
        }. Publish it in the Waffo dashboard before accepting payments.`
      );
    }
  }

  if (product.status === ProductVersionStatus.Inactive && !hasFlag('--no-activate')) {
    try {
      const activated = await client.subscriptionProducts.updateStatus({
        id: product.id,
        status: ProductVersionStatus.Active,
      });
      product = activated.product ?? product;
      console.log(`Activated product ${product.id}.`);
    } catch (error) {
      console.warn(
        `Could not activate the product automatically: ${
          error instanceof Error ? error.message : error
        }. Activate it in the Waffo dashboard.`
      );
    }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/+$/, '');
  const webhookUrl = normaliseUrl(
    argValue('--url') ||
      process.env.WAFFO_WEBHOOK_URL ||
      (appUrl ? `${appUrl}/api/webhooks/waffo` : '')
  );
  const testMode =
    hasFlag('--test') ||
    ['1', 'true', 'yes'].includes(String(process.env.WAFFO_WEBHOOK_TEST_MODE || '').toLowerCase());

  if (hasFlag('--no-webhook')) {
    console.log('Skipping webhook setup (--no-webhook).');
  } else if (!webhookUrl) {
    console.log(
      'No webhook URL provided. Set WAFFO_WEBHOOK_URL or NEXT_PUBLIC_APP_URL, or add it in the Waffo dashboard.'
    );
  } else if (!webhookUrl.startsWith('https://')) {
    console.warn(`Webhook URL should use HTTPS: ${webhookUrl}`);
  } else {
    let webhooks = [];
    let canManageWebhooks = true;
    try {
      webhooks = await readWebhooks(storeId);
    } catch (error) {
      canManageWebhooks = false;
      console.warn(
        `Could not read existing webhooks, so I am not adding one automatically: ${
          error instanceof Error ? error.message : error
        }`
      );
    }

    if (canManageWebhooks) {
      const target = normaliseUrl(webhookUrl);
      const existing = webhooks.find(
        (webhook) =>
          webhook.channel === 'http' &&
          normaliseUrl(webhook.url) === target &&
          Boolean(webhook.testMode) === testMode
      );

      if (existing) {
        const current = Array.isArray(existing.events) ? existing.events : [];
        const missing = WEBHOOK_EVENTS.filter((event) => !current.includes(event));
        if (missing.length) {
          await client.webhooks.update({ id: existing.id, events: WEBHOOK_EVENTS });
          console.log(`Updated webhook ${existing.id} with ${WEBHOOK_EVENTS.length} events.`);
        } else {
          console.log(`Webhook already configured: ${existing.id} (${testMode ? 'test' : 'prod'} mode).`);
        }
      } else {
        const result = await client.webhooks.add({
          storeId,
          channel: 'http',
          url: target,
          events: WEBHOOK_EVENTS,
          testMode,
        });
        console.log(
          `Added webhook ${result.webhook.id} → ${target} (${testMode ? 'test' : 'prod'} mode, ${
            WEBHOOK_EVENTS.length
          } events).`
        );
      }

      if (testMode) {
        console.log('Webhook is registered in test mode — use a Waffo test API key for checkout.');
      } else {
        console.log('Webhook is registered in production mode — use your live Waffo key for checkout.');
      }
    }
  }

  console.log('\nDone. Add/confirm these values in .env.local and on your host:');
  console.log(`WAFFO_MERCHANT_ID=${merchantId}`);
  console.log(`WAFFO_STORE_ID=${storeId}`);
  console.log(`WAFFO_PRODUCT_ID=${product.id}`);
  console.log('SUPABASE_SERVICE_ROLE_KEY=<from Supabase project settings>');
  if (webhookUrl) console.log(`\nWebhook endpoint: ${webhookUrl}`);
  console.log('\nThen verify with: npm run waffo:check');
}

main().catch((error) => {
  if (error instanceof WaffoPancakeError) {
    console.error(`Waffo error ${error.status}:`);
    for (const item of error.errors ?? []) console.error(`  - ${item.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
