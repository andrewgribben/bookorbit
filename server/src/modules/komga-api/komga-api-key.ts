import { createHash, randomBytes } from 'crypto';

import { KOMGA_API_KEY_BYTES, KOMGA_API_KEY_PREFIX } from './komga-api.constants';

/** Long enough to distinguish keys without revealing them. */
const KOMGA_API_KEY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const key = `${KOMGA_API_KEY_PREFIX}${randomBytes(KOMGA_API_KEY_BYTES).toString('base64url')}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, KOMGA_API_KEY_PREFIX_LENGTH),
  };
}

/** Stored as hash; only the prefix is shown on list. */
export function maskApiKey(keyPrefix: string): string {
  return `${keyPrefix}...`;
}
