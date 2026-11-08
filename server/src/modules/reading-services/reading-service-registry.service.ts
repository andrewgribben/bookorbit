import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceProvider } from '@bookorbit/types';

import type { ReadingServiceProviderAdapter } from './reading-service-provider';

/**
 * Collects provider adapters registered by each provider module's `onModuleInit`. Phase 2's
 * Hardcover adapter registers the same way, which is what keeps this core module from knowing
 * anything provider-specific.
 */
@Injectable()
export class ReadingServiceRegistry {
  private readonly logger = new Logger(ReadingServiceRegistry.name);
  private readonly adapters = new Map<ReadingServiceProvider, ReadingServiceProviderAdapter>();

  register(adapter: ReadingServiceProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
    this.logger.log(`[reading_services.registry] [end] provider=${adapter.provider} - adapter registered`);
  }

  get(provider: ReadingServiceProvider): ReadingServiceProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  has(provider: ReadingServiceProvider): boolean {
    return this.adapters.has(provider);
  }

  list(): ReadingServiceProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
