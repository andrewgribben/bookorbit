import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseKomgaConnectionConfig } from './komga-connection-config';

describe('parseKomgaConnectionConfig', () => {
  it('normalizes the origin and defaults private-network access to false', () => {
    expect(
      parseKomgaConnectionConfig({
        baseUrl: ' https://komga.example.com:25600/ ',
        apiToken: ' token-value ',
      }),
    ).toEqual({
      baseUrl: 'https://komga.example.com:25600',
      apiToken: 'token-value',
      allowPrivateNetwork: false,
    });
  });

  it('preserves explicit private-network access', () => {
    expect(
      parseKomgaConnectionConfig({
        baseUrl: 'http://192.168.1.5:25600',
        apiToken: 'secret',
        allowPrivateNetwork: true,
      }),
    ).toMatchObject({ allowPrivateNetwork: true });
  });

  it.each([
    [{ baseUrl: 'ftp://komga.example.com', apiToken: 'secret' }],
    [{ baseUrl: 'https://komga.example.com/path', apiToken: 'secret' }],
    [{ baseUrl: 'https://user:pass@komga.example.com', apiToken: 'secret' }],
    [{ baseUrl: 'https://komga.example.com', apiToken: '  ' }],
    [null],
    ['token'],
  ])('rejects invalid configuration %#', (raw) => {
    expect(() => parseKomgaConnectionConfig(raw)).toThrow(BadRequestException);
  });
});
