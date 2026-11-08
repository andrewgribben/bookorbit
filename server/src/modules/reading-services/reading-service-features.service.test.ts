import { BadRequestException } from '@nestjs/common';

import { ReadingServiceFeaturesService } from './reading-service-features.service';
import type { ReadingServiceRegistry } from './reading-service-registry.service';
import type { ReadingServicesRepository } from './reading-services.repository';

describe('ReadingServiceFeaturesService', () => {
  function makeService(capabilities: Record<string, string> = {}) {
    const repo = { findFeatures: vi.fn(), setFeature: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServicesRepository;
    const registry = { get: vi.fn().mockReturnValue({ provider: 'readwise', capabilities }) } as unknown as ReadingServiceRegistry;
    return { service: new ReadingServiceFeaturesService(repo, registry), repo, registry };
  }

  it('returns the stored features for a provider', async () => {
    const { service, repo } = makeService();
    (repo.findFeatures as any).mockResolvedValue({ status: true });

    await expect(service.getFeatures(1, 'readwise')).resolves.toEqual({ status: true });
    expect(repo.findFeatures).toHaveBeenCalledWith(1, 'readwise');
  });

  it('persists a supported feature toggle', async () => {
    const { service, repo } = makeService({ status: 'both' });

    await service.setFeatures(1, 'readwise', { status: true });

    expect(repo.setFeature).toHaveBeenCalledWith(1, 'readwise', 'status', true);
  });

  it('rejects a feature the provider does not support', async () => {
    const { service } = makeService({ status: 'both' });

    await expect(service.setFeatures(1, 'readwise', { highlights: true })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown feature name even if capabilities somehow allow it', async () => {
    const { service } = makeService({ bogus: 'both' } as any);

    await expect(service.setFeatures(1, 'readwise', { bogus: true } as any)).rejects.toThrow(BadRequestException);
  });

  it('skips entries explicitly left undefined', async () => {
    const { service, repo } = makeService({ status: 'both' });

    await service.setFeatures(1, 'readwise', { status: undefined });

    expect(repo.setFeature).not.toHaveBeenCalled();
  });
});
