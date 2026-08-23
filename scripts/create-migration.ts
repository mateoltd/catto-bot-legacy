import 'dotenv/config';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const rawName = process.argv[2];
if (!rawName) {
  fail('Usage: pnpm prisma:migrate:create -- <migration_name>');
}

const migrationName = rawName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!migrationName) {
  fail('Invalid migration name. Use letters, numbers, and underscores.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail('DATABASE_URL is not set.');
}

let baseUrl: URL;
try {
  baseUrl = new URL(databaseUrl);
} catch {
  fail('DATABASE_URL is invalid.');
}

if (baseUrl.protocol !== 'postgres:' && baseUrl.protocol !== 'postgresql:') {
  fail('This helper currently supports PostgreSQL URLs only.');
}

const scratchSuffix = `${Date.now()}_${randomBytes(3).toString('hex')}`;
const scratchDbName = `test_migrate_${scratchSuffix}`;

const adminUrl = new URL(baseUrl.toString());
adminUrl.pathname = '/postgres';

const scratchUrl = new URL(baseUrl.toString());
scratchUrl.pathname = `/${scratchDbName}`;

const runDbSql = (sql: string) => {
  const sqlFile = join(tmpdir(), `prisma-migrate-${Date.now()}-${randomBytes(2).toString('hex')}.sql`);
  try {
    writeFileSync(sqlFile, sql);
    execSync(`pnpm prisma db execute --file "${sqlFile}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: adminUrl.toString(),
      },
    });
  } finally {
    try {
      unlinkSync(sqlFile);
    } catch {
      // no-op
    }
  }
};

try {
  console.log(`Creating scratch database: ${scratchDbName}`);
  runDbSql(`DROP DATABASE IF EXISTS "${scratchDbName}"; CREATE DATABASE "${scratchDbName}";`);

  console.log(`Generating migration "${migrationName}"...`);
  execSync(`pnpm prisma migrate dev --name "${migrationName}" --create-only`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: scratchUrl.toString(),
    },
  });

  console.log('Migration created successfully.');
} finally {
  try {
    console.log(`Cleaning scratch database: ${scratchDbName}`);
    runDbSql(`DROP DATABASE IF EXISTS "${scratchDbName}";`);
  } catch (error) {
    console.warn('Warning: failed to clean scratch database automatically.', error);
  }
}
