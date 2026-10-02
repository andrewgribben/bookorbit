import { readFileSync } from 'fs';
import { join } from 'path';

import { Permission } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import type { KomgaBook, KomgaSeries } from './komga-api.types';
import {
  bookSourceFixture,
  collectionSourceFixture,
  epubInfoFixture,
  librarySourceFixture,
  pageEntriesFixture,
  pageEntryFixture,
  readListSourceFixture,
  seriesSourceFixture,
} from './komga-response-fixtures';
import { toKomgaPage } from './komga-ids';
import {
  toKomgaApiKey,
  toKomgaBook,
  toKomgaCollection,
  toKomgaDivinaManifest,
  toKomgaEpubManifest,
  toKomgaEpubPositions,
  toKomgaEpubProgression,
  toKomgaLibrary,
  toKomgaPageEntry,
  toKomgaPositions,
  toKomgaProgression,
  toKomgaReadList,
  toKomgaSeries,
  toKomgaUser,
} from './komga.mappers';

interface JsonSchema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
}

interface Spec {
  components: { schemas: Record<string, JsonSchema> };
}

const spec = JSON.parse(readFileSync(join(__dirname, 'openapi', 'komga-openapi.json'), 'utf8')) as Spec;

function resolve(schema: JsonSchema): JsonSchema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').pop() as string;
  const target = spec.components.schemas[name];
  if (!target) throw new Error(`Unknown schema reference: ${schema.$ref}`);
  return target;
}

/**
 * A deliberately small JSON Schema checker.
 *
 * It exists to answer one question the pinned document can answer: does a payload this module emits
 * look like what Komga says it emits? It checks property names, required properties, primitive
 * types, date formats and enums - the parts that break clients. It is not a general validator and
 * does not claim to be.
 */
function check(value: unknown, schema: JsonSchema, path: string, failures: string[]): void {
  if (schema.oneOf || schema.anyOf) {
    const alternatives = schema.oneOf ?? schema.anyOf ?? [];
    const matched = alternatives.some((alternative) => {
      const nested: string[] = [];
      check(value, resolve(alternative), path, nested);
      return nested.length === 0;
    });
    if (!matched) failures.push(`${path}: matched none of ${alternatives.length} alternatives`);
    return;
  }

  if (schema.allOf) {
    for (const part of schema.allOf) check(value, resolve(part), path, failures);
    return;
  }

  const resolved = resolve(schema);

  if (resolved.enum && !resolved.enum.some((candidate) => candidate === value)) {
    failures.push(`${path}: ${JSON.stringify(value)} is not one of ${resolved.enum.join(', ')}`);
    return;
  }

  switch (resolved.type) {
    case undefined:
      return;
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        failures.push(`${path}: expected an object`);
        return;
      }
      const record = value as Record<string, unknown>;
      for (const required of resolved.required ?? []) {
        if (!(required in record)) failures.push(`${path}: missing required property ${required}`);
      }
      const properties = resolved.properties ?? {};
      for (const [key, nested] of Object.entries(record)) {
        // `undefined` is not a JSON value: a dropped key is an absent key.
        if (nested === undefined) continue;
        const propertySchema = properties[key];
        if (!propertySchema) {
          if (
            !PARAMETER_ALLOWED_EXTRA_PROPERTIES.has(key) &&
            resolved.additionalProperties !== true &&
            resolved.additionalProperties === undefined &&
            Object.keys(properties).length > 0
          ) {
            failures.push(`${path}: unexpected property ${key}`);
          }
          continue;
        }
        check(nested, propertySchema, `${path}.${key}`, failures);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        failures.push(`${path}: expected an array`);
        return;
      }
      if (resolved.items) value.forEach((entry, index) => check(entry, resolved.items as JsonSchema, `${path}[${index}]`, failures));
      return;
    }
    case 'integer': {
      if (!Number.isInteger(value)) failures.push(`${path}: expected an integer`);
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) failures.push(`${path}: expected a number`);
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') failures.push(`${path}: expected a boolean`);
      return;
    }
    case 'string': {
      if (typeof value !== 'string') {
        failures.push(`${path}: expected a string`);
        return;
      }
      if (resolved.format === 'date-time' && Number.isNaN(new Date(value).getTime())) {
        failures.push(`${path}: ${value} is not a date-time`);
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Komga emits `children` on TOC links for nested navigation and its clients decode them, but the
 * pinned document leaves the field out of WPLinkDto. Allowed rather than dropped from the payload.
 */
const PARAMETER_ALLOWED_EXTRA_PROPERTIES = new Set(['children']);

function expectConforms(schemaName: string, payload: unknown): void {
  const failures: string[] = [];
  check(payload, { $ref: `#/components/schemas/${schemaName}` }, schemaName, failures);
  expect(failures, `${schemaName} payload does not match the pinned Komga schema`).toEqual([]);
}

function requestUser(): RequestUser {
  return {
    id: 42,
    username: 'reader',
    name: 'Reader',
    email: 'reader@example.com',
    active: true,
    isSuperuser: false,
    isDefaultPassword: false,
    tokenVersion: 1,
    settings: {},
    avatarUrl: null,
    provisioningMethod: 'local',
    permissions: [Permission.LibraryDownload],
    contentFilters: undefined,
  } as unknown as RequestUser;
}

describe('Komga response conformance against the pinned OpenAPI document', () => {
  it('emits a BookDto the pinned schema accepts', () => {
    expectConforms('BookDto', toKomgaBook(bookSourceFixture()));
  });

  it('emits a BookDto with read progress for a partly read book', () => {
    const payload = toKomgaBook(
      bookSourceFixture({
        progress: { pageNumber: 7, percentage: 35, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T10:00:00.000Z' },
      }),
    );
    expectConforms('BookDto', payload);
    expectConforms('ReadProgressDto', payload.readProgress);
  });

  it('emits a SeriesDto the pinned schema accepts', () => {
    expectConforms('SeriesDto', toKomgaSeries(seriesSourceFixture()));
  });

  it('emits a LibraryDto the pinned schema accepts', () => {
    expectConforms('LibraryDto', toKomgaLibrary(librarySourceFixture()));
  });

  it('emits CollectionDto and ReadListDto the pinned schemas accept', () => {
    expectConforms('CollectionDto', toKomgaCollection(collectionSourceFixture()));
    expectConforms('ReadListDto', toKomgaReadList(readListSourceFixture()));
  });

  it('emits a UserDto the pinned schema accepts', () => {
    expectConforms('UserDto', toKomgaUser(requestUser(), [1, 2], true));
  });

  it('emits a PageDto and the paging envelope the pinned schemas accept', () => {
    expectConforms('PageDto', toKomgaPageEntry(pageEntryFixture(), 0));
    expectConforms('PageBookDto', toKomgaPage<KomgaBook>([toKomgaBook(bookSourceFixture())], 1, 0, 20, true));
    expectConforms('PageSeriesDto', toKomgaPage<KomgaSeries>([toKomgaSeries(seriesSourceFixture())], 1, 0, 20, true));
  });

  it('emits an ApiKeyDto the pinned schema accepts', () => {
    expectConforms('ApiKeyDto', toKomgaApiKey(1, 42, 'Komelia', '2026-09-19T10:00:00.000Z', 'bko_abcdefghijklmnop'));
  });

  it('emits the manifest, positions and progression the pinned schemas accept', () => {
    const pages = pageEntriesFixture(3);
    const readSource = bookSourceFixture({
      progress: { pageNumber: 2, percentage: 66, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T10:00:00.000Z' },
    });

    expectConforms('WPPublicationDto', toKomgaDivinaManifest(bookSourceFixture(), pages, 1287));
    expectConforms('R2Positions', toKomgaPositions(pages, 1287));
    expectConforms('R2Progression', toKomgaProgression(readSource, 1287));
  });

  it('keeps a TOC fragment out of the encoded resource path', () => {
    const manifest = toKomgaEpubManifest(bookSourceFixture(), epubInfoFixture(), 1287) as {
      readingOrder: { href: string }[];
      toc: { children?: { href?: string; title?: string }[] }[];
    };

    expect(manifest.readingOrder[0].href).toBe('/komga/api/v1/books/1287/resource/OPS/chapter1.xhtml');
  });

  it('emits the EPUB manifest, positions and progression the pinned schemas accept', () => {
    const info = epubInfoFixture();
    const epubSource = bookSourceFixture({ primaryFile: { ...bookSourceFixture().primaryFile!, format: 'epub' } });
    const readSource = bookSourceFixture({
      primaryFile: { ...bookSourceFixture().primaryFile!, format: 'epub' },
      progress: { pageNumber: null, percentage: 40, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T10:00:00.000Z' },
    });

    expectConforms('WPPublicationDto', toKomgaEpubManifest(epubSource, info, 1287));
    expectConforms('R2Positions', toKomgaEpubPositions(info, 1287));
    expectConforms('R2Progression', toKomgaEpubProgression(readSource, info, 1287));
  });
});
