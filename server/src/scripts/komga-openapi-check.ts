import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Proves the vendored Komga OpenAPI snapshot is still upstream's document.
 *
 * The module's conformance tests are only as meaningful as the snapshot they check against, so this
 * check fails loudly whenever Komga moves: it prints what changed and leaves the decision to a
 * human. Run it with `pnpm komga:openapi:check`, from CI on a schedule, or before refreshing the
 * snapshot.
 */
const UPSTREAM_URL = 'https://raw.githubusercontent.com/gotson/komga/master/komga/docs/openapi.json';
const SNAPSHOT_PATH = join(__dirname, '..', 'modules', 'komga-api', 'openapi', 'komga-openapi.json');
const VERBS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface OpenApiDocument {
  info: { version: string };
  paths: Record<string, Partial<Record<(typeof VERBS)[number], { parameters?: { name: string; in: string }[] }>>>;
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
}

function readDocument(path: string, label: string): { raw: string; document: OpenApiDocument } {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`FAILED: cannot read the ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  try {
    return { raw, document: JSON.parse(raw) as OpenApiDocument };
  } catch (error) {
    console.error(`FAILED: the ${label} at ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function operationKeys(document: OpenApiDocument): Map<string, string[]> {
  const operations = new Map<string, string[]>();
  for (const [path, item] of Object.entries(document.paths)) {
    for (const verb of VERBS) {
      const operation = item[verb];
      if (!operation) continue;
      operations.set(
        `${verb.toUpperCase()} ${path}`,
        (operation.parameters ?? []).map((parameter) => `${parameter.in}:${parameter.name}`),
      );
    }
  }
  return operations;
}

function describeDifferences(snapshot: OpenApiDocument, upstream: OpenApiDocument): string[] {
  const differences: string[] = [];
  differences.push(`version: snapshot ${snapshot.info.version} -> upstream ${upstream.info.version}`);

  const snapshotOperations = operationKeys(snapshot);
  const upstreamOperations = operationKeys(upstream);

  for (const key of upstreamOperations.keys()) {
    if (!snapshotOperations.has(key)) differences.push(`added upstream:   ${key}`);
  }
  for (const key of snapshotOperations.keys()) {
    if (!upstreamOperations.has(key)) differences.push(`removed upstream: ${key}`);
  }
  for (const [key, parameters] of upstreamOperations) {
    const current = snapshotOperations.get(key);
    if (!current) continue;
    const added = parameters.filter((parameter) => !current.includes(parameter));
    const removed = current.filter((parameter) => !parameters.includes(parameter));
    if (added.length > 0 || removed.length > 0) {
      differences.push(
        `parameters changed: ${key}${added.length > 0 ? ` (+${added.join(', ')})` : ''}${removed.length > 0 ? ` (-${removed.join(', ')})` : ''}`,
      );
    }
  }

  const snapshotSchemas = snapshot.components.schemas;
  const upstreamSchemas = upstream.components.schemas;
  for (const name of new Set([...Object.keys(snapshotSchemas), ...Object.keys(upstreamSchemas)])) {
    const snapshotProperties = Object.keys(snapshotSchemas[name]?.properties ?? {});
    const upstreamProperties = Object.keys(upstreamSchemas[name]?.properties ?? {});
    const added = upstreamProperties.filter((property) => !snapshotProperties.includes(property));
    const removed = snapshotProperties.filter((property) => !upstreamProperties.includes(property));
    if (added.length > 0 || removed.length > 0) {
      differences.push(`schema ${name}:${added.length > 0 ? ` +[${added.join(', ')}]` : ''}${removed.length > 0 ? ` -[${removed.join(', ')}]` : ''}`);
    }
  }

  return differences;
}

async function run(): Promise<void> {
  const snapshotPath = process.argv[2] ?? SNAPSHOT_PATH;
  const snapshot = readDocument(snapshotPath, 'snapshot');

  let upstreamRaw: string;
  try {
    const response = await fetch(UPSTREAM_URL);
    if (!response.ok) {
      console.error(`FAILED: upstream returned HTTP ${response.status} for ${UPSTREAM_URL}`);
      process.exit(1);
    }
    upstreamRaw = await response.text();
  } catch (error) {
    console.error(`FAILED: cannot reach upstream at ${UPSTREAM_URL}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (upstreamRaw === snapshot.raw) {
    const sha256 = createHash('sha256').update(snapshot.raw).digest('hex');
    console.log(`komga-openapi-in-sync version=${snapshot.document.info.version} sha256=${sha256}`);
    return;
  }

  const upstream = JSON.parse(upstreamRaw) as OpenApiDocument;
  console.error('Komga upstream changed. The pinned snapshot no longer matches the published document.\n');
  for (const line of describeDifferences(snapshot.document, upstream)) console.error(`  ${line}`);

  console.error('\nNext steps:');
  console.error('  1. Review each difference above against the module mapping (docs in .idea/docs).');
  console.error('  2. Re-run the module conformance tests; update handlers/DTOs for anything that moved.');
  console.error('  3. Refresh the snapshot:');
  console.error(`     curl -sS -o ${snapshotPath} ${UPSTREAM_URL}`);
  console.error('  4. Re-run this check and the conformance tests.');
  process.exit(1);
}

void run();
