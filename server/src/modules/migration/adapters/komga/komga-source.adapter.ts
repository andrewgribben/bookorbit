import { Injectable } from '@nestjs/common';

import type { SourceAdapter, SourceExportData, SourceSnapshot, SourceValidationResult } from '../source-adapter.types';
import { KomgaApiConnector } from './komga-api.connector';
import type { KomgaConnectionConfig } from './komga-connection-config';
import { KomgaNormalizer } from './komga-normalizer';
import type { KomgaNormalizationResult } from './komga-source.types';

@Injectable()
export class KomgaSourceAdapter implements SourceAdapter<KomgaConnectionConfig> {
  readonly type = 'komga';

  constructor(
    private readonly apiConnector: KomgaApiConnector,
    private readonly normalizer: KomgaNormalizer,
  ) {}

  async validate(config: KomgaConnectionConfig): Promise<SourceValidationResult> {
    const summary = await this.apiConnector.fetchSnapshotSummary(config);
    return {
      ok: true,
      sourceType: this.type,
      sourceVersion: summary.sourceVersion,
      missingTables: [],
      warnings: summary.warnings,
      counts: summary.counts,
    };
  }

  async snapshot(config: KomgaConnectionConfig): Promise<SourceSnapshot> {
    const summary = await this.apiConnector.fetchSnapshotSummary(config);
    return {
      generatedAt: new Date().toISOString(),
      sourceType: this.type,
      sourceVersion: summary.sourceVersion,
      counts: summary.counts,
    };
  }

  async exportData(config: KomgaConnectionConfig): Promise<SourceExportData> {
    return (await this.fetchNormalized(config)).data;
  }

  async fetchPathPrefixes(config: KomgaConnectionConfig): Promise<string[]> {
    const roots = await this.apiConnector.fetchLibraryRoots(config);
    const prefixes = new Set<string>();
    for (const root of roots) {
      const value = root.trim();
      const normalized = value !== '/' && !/^[A-Za-z]:[\\/]$/.test(value) ? value.replace(/[\\/]+$/, '') : value;
      if (normalized) prefixes.add(normalized);
    }
    return [...prefixes].sort((left, right) => left.localeCompare(right));
  }

  private async fetchNormalized(config: KomgaConnectionConfig): Promise<KomgaNormalizationResult> {
    const records = await this.apiConnector.fetchSourceRecords(config);
    return this.normalizer.normalize(records);
  }
}
