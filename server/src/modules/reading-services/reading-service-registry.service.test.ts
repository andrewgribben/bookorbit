import { ReadingServiceProviderAdapter } from './reading-service-provider';
import { ReadingServiceRegistry } from './reading-service-registry.service';

describe('ReadingServiceRegistry', () => {
  function makeAdapter(provider: 'readwise' | 'hardcover'): ReadingServiceProviderAdapter {
    return {
      provider,
      capabilities: {},
      isConnected: vi.fn().mockResolvedValue(false),
      migratePage: vi.fn().mockResolvedValue(null),
      pull: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('returns an adapter registered for its provider', () => {
    const registry = new ReadingServiceRegistry();
    const adapter = makeAdapter('readwise');

    registry.register(adapter);

    expect(registry.get('readwise')).toBe(adapter);
    expect(registry.has('readwise')).toBe(true);
  });

  it('returns undefined and false for a provider nothing has registered', () => {
    const registry = new ReadingServiceRegistry();

    expect(registry.get('hardcover')).toBeUndefined();
    expect(registry.has('hardcover')).toBe(false);
  });

  it('lists every registered adapter', () => {
    const registry = new ReadingServiceRegistry();
    const readwise = makeAdapter('readwise');
    const hardcover = makeAdapter('hardcover');

    registry.register(readwise);
    registry.register(hardcover);

    expect(registry.list()).toEqual(expect.arrayContaining([readwise, hardcover]));
    expect(registry.list()).toHaveLength(2);
  });
});
