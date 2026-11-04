/* Diagnoses the Supabase side of the Waffo integration (never run in CI):
   1. Which columns the `profiles` table actually has (migration applied?)
   2. Whether profile rows carry subscription state
   3. Whether a test signup succeeds (a failing trigger on auth.users shows up
      here as GoTrue's "Database error saving new user")
   4. Cleans up the test user afterwards with the service key.

   Usage: node scripts/supabase-diagnose.mjs
*/

import { loadEnvLocal } from './load-env.mjs';

loadEnvLocal();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !serviceKey || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.');
  process.exit(1);
}

const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const print = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);

/* 1. profiles table columns (PostgREST OpenAPI) */
try {
  const res = await fetch(`${url}/rest/v1/`, { headers: serviceHeaders });
  const spec = await res.json();
  const profiles = spec?.definitions?.profiles;
  if (!profiles) {
    console.log('profiles table: NOT FOUND in the schema — the base tables SQL has not been applied.');
  } else {
    console.log(`profiles columns: ${Object.keys(profiles.properties ?? {}).join(', ')}`);
    const needed = ['subscription_status', 'trial_ends_at', 'subscription_ends_at', 'waffo_order_id', 'updated_at'];
    const missing = needed.filter((name) => !(name in (profiles.properties ?? {})));
    console.log(missing.length
      ? `MISSING subscription columns (run supabase/subscriptions.sql): ${missing.join(', ')}`
      : 'All subscription columns are present.');
  }
} catch (error) {
  console.log(`Schema check failed: ${error instanceof Error ? error.message : error}`);
}

/* 2. Existing profile rows (does any row have subscription state?) */
try {
  const res = await fetch(
    `${url}/rest/v1/profiles?select=id,email,subscription_status,trial_ends_at,subscription_ends_at,waffo_order_id&limit=3`,
    { headers: serviceHeaders }
  );
  const body = await res.json();
  if (!res.ok) {
    print('profiles select failed', body.message ?? body);
  } else {
    console.log(`profiles rows (first 3): ${JSON.stringify(body)}`);
    console.log(`profiles count: check manually if you need the total`);
  }
} catch (error) {
  console.log(`profiles select threw: ${error instanceof Error ? error.message : error}`);
}

/* 3. Test signup reproduces the "Database error saving new user"? */
const testEmail = `waffo-diag-${Date.now()}@example.com`;
let createdUserId = null;
try {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email: testEmail, password: `Diag-${Date.now()}-A1b2c3`, data: { name: 'Diagnostics' } }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`signup HTTP ${res.status}`);
  if (res.ok) {
    createdUserId = body.user?.id ?? body.id ?? null;
    console.log(`signup OK — user ${createdUserId ?? '(no id)'}`);
    if (!body.access_token) console.log('Note: email confirmation is enabled — the app inserts the profile without a session, which fails RLS.');
  } else {
    print('signup error', body.msg ?? body.message ?? body.error_description ?? body.error ?? body);
    if (String(body.msg ?? '').includes('Database error saving new user')) {
      console.log("→ GoTrue could not insert the user: a database trigger on auth.users is failing. Check the Supabase dashboard's Logs → Auth/Postgres for the underlying message.");
    }
  }
} catch (error) {
  console.log(`signup request threw: ${error instanceof Error ? error.message : error}`);
}

/* 4. Delete the diagnostic user so the project stays clean */
if (createdUserId) {
  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${createdUserId}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
    console.log(`cleanup: test user ${res.ok ? 'deleted' : `not deleted (HTTP ${res.status})`}`);
  } catch (error) {
    console.log(`cleanup threw: ${error instanceof Error ? error.message : error}`);
  }
}
