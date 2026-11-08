import { BadRequestException, Injectable } from '@nestjs/common';

import {
  READING_SERVICE_FEATURES,
  READING_SERVICE_FEATURES_DEFAULT_OFF,
  type ReadingServiceFeature,
  type ReadingServiceProvider,
} from '@bookorbit/types';

import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServicesRepository } from './reading-services.repository';

@Injectable()
export class ReadingServiceFeaturesService {
  constructor(
    private readonly repo: ReadingServicesRepository,
    private readonly registry: ReadingServiceRegistry,
  ) {}

  async getFeatures(userId: number, provider: ReadingServiceProvider): Promise<Partial<Record<ReadingServiceFeature, boolean>>> {
    const stored = await this.repo.findFeatures(userId, provider);
    const withDefaults: Partial<Record<ReadingServiceFeature, boolean>> = { ...stored };
    for (const feature of READING_SERVICE_FEATURES_DEFAULT_OFF) {
      if (withDefaults[feature] === undefined) withDefaults[feature] = false;
    }
    return withDefaults;
  }

  async setFeatures(userId: number, provider: ReadingServiceProvider, features: Partial<Record<ReadingServiceFeature, boolean>>): Promise<void> {
    const adapter = this.registry.get(provider);
    const capabilities = adapter?.capabilities ?? {};

    for (const [feature, enabled] of Object.entries(features) as [ReadingServiceFeature, boolean | undefined][]) {
      if (enabled === undefined) continue;
      if (!READING_SERVICE_FEATURES.includes(feature)) {
        throw new BadRequestException(`Unknown reading-service feature: ${feature}`);
      }
      if (!capabilities[feature]) {
        throw new BadRequestException(`${provider} does not support the "${feature}" feature`);
      }
      await this.repo.setFeature(userId, provider, feature, enabled);
    }
  }
}
