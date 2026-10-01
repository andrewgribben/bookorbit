import { readFileSync } from 'fs';
import { join } from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { KomgaBookController } from './komga-book.controller';
import { KomgaCollectionController } from './komga-collection.controller';
import { KomgaLibraryController } from './komga-library.controller';
import { KomgaReadListController } from './komga-readlist.controller';
import { KomgaSeriesController } from './komga-series.controller';
import { KomgaSystemController } from './komga-system.controller';
import { KomgaUserController } from './komga-user.controller';

/** The mount the module is served under, from `app.setGlobalPrefix('api/v1')` exclusion of `komga/(.*)`. */
const MOUNT_PREFIX = '/komga';

const CONTROLLERS = [
  KomgaUserController,
  KomgaLibraryController,
  KomgaSeriesController,
  KomgaBookController,
  KomgaCollectionController,
  KomgaReadListController,
  KomgaSystemController,
];

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

interface KomgaOperation {
  method: string;
  path: string;
  requiredParameters: { name: string; in: string }[];
}

const VERBS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface KomgaSpecOperation {
  parameters?: { name: string; in: string; required?: boolean }[];
}

function loadSpec(): { version: string; operations: Map<string, KomgaOperation> } {
  const spec = JSON.parse(readFileSync(join(__dirname, 'openapi', 'komga-openapi.json'), 'utf8')) as {
    info: { version: string };
    paths: Record<string, Partial<Record<(typeof VERBS)[number], KomgaSpecOperation>>>;
  };

  const operations = new Map<string, KomgaOperation>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const verb of VERBS) {
      const operation = item[verb];
      if (!operation) continue;
      operations.set(`${verb} ${path}`, {
        method: verb,
        path,
        requiredParameters: (operation.parameters ?? [])
          .filter((parameter) => parameter.required === true)
          .map((parameter) => ({ name: parameter.name, in: parameter.in })),
      });
    }
  }

  return { version: spec.info.version, operations };
}

/** Reads the routes the controllers actually declare, through the same metadata Nest dispatches on. */
function declaredRoutes(): { method: string; path: string; handler: string }[] {
  const routes: { method: string; path: string; handler: string }[] = [];

  for (const controller of CONTROLLERS) {
    const classPath = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
    if (classPath !== 'komga') {
      throw new Error(`${controller.name} must be mounted at 'komga'`);
    }

    for (const propertyName of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[propertyName] as (...args: never[]) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (requestMethod === undefined) continue;

      const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const declared = `/${[classPath, methodPath].filter(Boolean).join('/')}`;
      if (!declared.startsWith(MOUNT_PREFIX)) {
        throw new Error(`${controller.name}.${propertyName} does not live under ${MOUNT_PREFIX}: ${declared}`);
      }

      routes.push({
        method: METHOD_NAMES[requestMethod],
        // Nest's Fastify adapter only accepts a bare trailing `*`; the pinned document renders the
        // same Spring capture (`/resource/{*resource}`) as `/resource/{resource}`.
        path: declared
          .slice(MOUNT_PREFIX.length)
          .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
          .replace(/\/\*$/, '/{resource}'),
        handler: `${controller.name}.${propertyName}`,
      });
    }
  }

  return routes;
}

describe('Komga route conformance against the pinned OpenAPI document', () => {
  const spec = loadSpec();
  const routes = declaredRoutes();

  it('pins a Komga document with the expected version', () => {
    expect(spec.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(spec.operations.size).toBeGreaterThan(150);
  });

  it('declares routes the module can actually dispatch', () => {
    expect(routes.length).toBeGreaterThan(30);
    const keys = routes.map((route) => `${route.method} ${route.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exposes only routes that exist in the pinned Komga document, with the same path parameters', () => {
    const unknown = routes.filter((route) => !spec.operations.has(`${route.method} ${route.path}`));

    expect(
      unknown.map((route) => `${route.handler}: ${route.method.toUpperCase()} ${route.path}`),
      'these routes are not in the pinned Komga document; either remove them or raise the pinned version',
    ).toEqual([]);
  });

  it('implements every operation whose required parameters are only path parameters', () => {
    const nonPathRequired = routes
      .map((route) => ({ route, operation: spec.operations.get(`${route.method} ${route.path}`) }))
      .filter((entry) => entry.operation?.requiredParameters.some((parameter) => parameter.in !== 'path'));

    expect(
      nonPathRequired.map((entry) => `${entry.route.method.toUpperCase()} ${entry.route.path}`),
      'a required query or header parameter was added upstream; the handler and its DTO must declare it',
    ).toEqual([]);
  });
});
