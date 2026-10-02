import { BadRequestException } from '@nestjs/common';

export interface KomgaConnectionConfig {
  baseUrl: string;
  apiToken: string;
  allowPrivateNetwork: boolean;
}

export function parseKomgaConnectionConfig(raw: unknown): KomgaConnectionConfig {
  if (!isRecord(raw)) {
    throw new BadRequestException('Invalid Komga connection config: expected object');
  }

  const apiToken = typeof raw.apiToken === 'string' ? raw.apiToken.trim() : '';
  if (!apiToken) {
    throw new BadRequestException('Invalid Komga connection config: apiToken is required');
  }

  return {
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    apiToken,
    allowPrivateNetwork: raw.allowPrivateNetwork === true,
  };
}

function normalizeBaseUrl(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new BadRequestException('Invalid Komga connection config: baseUrl must be a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Invalid Komga connection config: baseUrl must use http or https');
  }
  if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new BadRequestException('Invalid Komga connection config: baseUrl must contain a clean HTTP origin');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new BadRequestException('Invalid Komga connection config: baseUrl must not contain a path');
  }

  return parsed.origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
