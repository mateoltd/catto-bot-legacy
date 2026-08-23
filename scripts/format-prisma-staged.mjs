import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function getPnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function getStagedPrismaFiles() {
  const args = process.argv.slice(2);
  const files = args
    .filter((arg) => arg.endsWith('.prisma'))
    .map((arg) => resolve(arg))
    .filter((file) => existsSync(file));

  return [...new Set(files)];
}

function formatPrismaSchema(file) {
  const result = spawnSync(getPnpmCommand(), ['exec', 'prisma', 'format', '--schema', file], {
    stdio: 'inherit',
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function main() {
  const files = getStagedPrismaFiles();

  if (files.length === 0) {
    console.log('No staged Prisma files to format');
    return;
  }

  for (const file of files) {
    formatPrismaSchema(file);
  }
}

try {
  main();
} catch (error) {
  console.error('Failed to format staged Prisma files:', error);
  process.exit(1);
}
