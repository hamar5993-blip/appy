/* Load .env.local for the standalone Waffo scripts without relying on a
   specific Node --env-file flag. Values already present in the real
   environment win, which is what production/CI expects. */

import { existsSync, readFileSync } from 'node:fs';

export function loadEnvLocal() {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env.local');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return;
  }

  // Fallback for Node versions before process.loadEnvFile().
  if (!existsSync('.env.local')) return;
  const text = readFileSync('.env.local', 'utf8');

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}
