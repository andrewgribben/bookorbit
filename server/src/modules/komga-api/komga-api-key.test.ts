import { generateApiKey, hashApiKey, maskApiKey } from './komga-api-key';
import { KOMGA_API_KEY_PREFIX } from './komga-api.constants';

describe('Komga API keys', () => {
  it('issues a prefixed key with a matching hash', () => {
    const generated = generateApiKey();

    expect(generated.key.startsWith(KOMGA_API_KEY_PREFIX)).toBe(true);
    expect(generated.key.length).toBeGreaterThan(40);
    expect(generated.keyHash).toBe(hashApiKey(generated.key));
    expect(generated.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(generated.keyPrefix).toBe(generated.key.slice(0, 12));
  });

  it('never issues the same key twice', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));

    expect(keys.size).toBe(50);
  });

  it('hashes deterministically, so a presented key can be looked up', () => {
    expect(hashApiKey('bko_fixed')).toBe(hashApiKey('bko_fixed'));
    expect(hashApiKey('bko_fixed')).not.toBe(hashApiKey('bko_fixed2'));
    expect(hashApiKey('bko_fixed')).not.toContain('bko_fixed');
  });

  it('masks a stored key so a listing cannot be replayed', () => {
    const generated = generateApiKey();
    const masked = maskApiKey(generated.keyPrefix);

    expect(masked.endsWith('...')).toBe(true);
    expect(masked).not.toBe(generated.key);
    expect(generated.key.startsWith(generated.keyPrefix)).toBe(true);
  });
});
