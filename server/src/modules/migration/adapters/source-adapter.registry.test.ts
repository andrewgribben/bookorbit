import { BadRequestException } from '@nestjs/common';

import { SourceAdapterRegistry } from './source-adapter.registry';

describe('SourceAdapterRegistry', () => {
  function makeRegistry() {
    const bookloreAdapter = {
      type: 'booklore',
      validate: vi.fn(),
      snapshot: vi.fn(),
      exportData: vi.fn(),
    };
    const grimmoryAdapter = {
      type: 'grimmory',
      validate: vi.fn(),
      snapshot: vi.fn(),
      exportData: vi.fn(),
    };
    const audiobookshelfAdapter = {
      type: 'audiobookshelf',
      validate: vi.fn(),
      snapshot: vi.fn(),
      exportData: vi.fn(),
    };
    const calibreWebAutomatedAdapter = {
      type: 'calibre_web_automated',
      validate: vi.fn(),
      snapshot: vi.fn(),
      exportData: vi.fn(),
    };
    const komgaAdapter = {
      type: 'komga',
      validate: vi.fn(),
      snapshot: vi.fn(),
      exportData: vi.fn(),
    };
    return {
      registry: new SourceAdapterRegistry(
        bookloreAdapter as never,
        grimmoryAdapter as never,
        audiobookshelfAdapter as never,
        calibreWebAutomatedAdapter as never,
        komgaAdapter as never,
      ),
      bookloreAdapter,
      grimmoryAdapter,
      audiobookshelfAdapter,
      calibreWebAutomatedAdapter,
      komgaAdapter,
    };
  }

  it('lists supported source types in sorted order', () => {
    const { registry } = makeRegistry();
    expect(registry.listTypes()).toEqual(['audiobookshelf', 'booklore', 'calibre_web_automated', 'grimmory', 'komga']);
  });

  it('retrieves adapter by normalized source type', () => {
    const { registry, bookloreAdapter, grimmoryAdapter, audiobookshelfAdapter, calibreWebAutomatedAdapter, komgaAdapter } = makeRegistry();

    expect(registry.get('booklore')).toBe(bookloreAdapter);
    expect(registry.get('  BOOKLORE ')).toBe(bookloreAdapter);
    expect(registry.get('grimmory')).toBe(grimmoryAdapter);
    expect(registry.get('  GRIMMORY ')).toBe(grimmoryAdapter);
    expect(registry.get('audiobookshelf')).toBe(audiobookshelfAdapter);
    expect(registry.get('  AUDIOBOOKSHELF ')).toBe(audiobookshelfAdapter);
    expect(registry.get('calibre_web_automated')).toBe(calibreWebAutomatedAdapter);
    expect(registry.get('  CALIBRE_WEB_AUTOMATED ')).toBe(calibreWebAutomatedAdapter);
    expect(registry.get('komga')).toBe(komgaAdapter);
    expect(registry.get('  KOMGA ')).toBe(komgaAdapter);
  });

  it('throws BadRequestException for unsupported source types', () => {
    const { registry } = makeRegistry();

    expect(() => registry.get('unknown')).toThrow(BadRequestException);
  });
});
