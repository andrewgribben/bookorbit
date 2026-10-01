import { randomUUID } from 'crypto';
import fastifyCookie from '@fastify/cookie';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { AppModule } from '../../../src/app.module';
import { GlobalExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { DB } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { MetadataService } from '../../../src/modules/metadata/metadata.service';
import { makeMetadataNoopMock } from '../app-harness';
import { createOpdsFixtureRoot } from '../opds/opds-fixture-builder';
import type { OpdsE2EContext } from '../opds/opds-harness';

type Db = NodePgDatabase<typeof schema>;

const ADMIN_PASSWORD = 'KomgaE2EAdmin123';

/**
 * Boots the app the way `main.ts` does.
 *
 * The shared OPDS harness registers no global ValidationPipe, and the Komga routes are written
 * against one: it is what coerces and rejects query parameters, so an end-to-end test without it
 * would exercise a different application. The returned object has the harness's shape, so the
 * existing library, scan and credential helpers work against it unchanged.
 */
export async function createKomgaE2EContext(): Promise<OpdsE2EContext> {
  const fixture = await createOpdsFixtureRoot();
  const envSnapshot = { appDataPath: process.env.APP_DATA_PATH };
  process.env.APP_DATA_PATH = fixture.booksPath;

  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MetadataService)
    .useValue(makeMetadataNoopMock())
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1', { exclude: ['komga/(.*)'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.register(fastifyCookie as never);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const db = app.get<Db>(DB);
  return { app, db, adminToken: await createAdminSession(app, db), fixture, envSnapshot };
}

/** The library scan route is JWT-guarded, so the spec needs one administrator session. */
async function createAdminSession(app: NestFastifyApplication, db: Db): Promise<string> {
  const username = `komga-e2e-admin-${randomUUID().slice(0, 8)}`;
  await db.insert(schema.users).values({
    username,
    name: 'Komga E2E Admin',
    email: `${username}@example.com`,
    passwordHash: await hash(ADMIN_PASSWORD, 4),
    isSuperuser: true,
    isDefaultPassword: false,
    provisioningMethod: 'local',
  });

  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: ADMIN_PASSWORD } });
  if (login.statusCode !== 200) throw new Error(`komga harness: admin login failed (${login.statusCode})`);

  const body = login.json() as { accessToken?: string };
  if (!body.accessToken) throw new Error('komga harness: admin login returned no access token');
  return body.accessToken;
}
