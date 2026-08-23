import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';
import { fixImportsInContent } from './lib/import-utils';

/**
 * Adds .js extensions to relative imports in TypeScript files for ESM compatibility.
 *
 * Usage:
 *   tsx scripts/fix-imports.ts                    # Fix all files in src/
 *   tsx scripts/fix-imports.ts src/index.ts       # Fix specific file(s)
 *
 * Designed to work with lint-staged.
 */

interface FixResult {
  file: string;
  fixed: number;
  imports: string[];
}

async function getFilesToProcess(): Promise<string[]> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const files: string[] = [];
    for (const arg of args) {
      if (arg.includes('*')) {
        const matches = await fg(arg, { absolute: true, onlyFiles: true });
        files.push(...matches.filter((f) => f.endsWith('.ts')));
      } else if (arg.endsWith('.ts')) {
        const resolved = resolve(arg);
        if (existsSync(resolved)) {
          files.push(resolved);
        }
      }
    }
    return files;
  }

  return fg('src/**/*.ts', { absolute: true, onlyFiles: true });
}

function processFile(file: string, projectRoot: string): FixResult {
  const content = readFileSync(file, 'utf-8');
  const relativeFile = file.replace(projectRoot, '').replace(/\\/g, '/').replace(/^\//, '');

  const { content: fixedContent, changes } = fixImportsInContent(content, file, projectRoot);

  if (changes.length > 0) {
    writeFileSync(file, fixedContent, 'utf-8');
  }

  return {
    file: relativeFile,
    fixed: changes.length,
    imports: changes.map((c) => `${c.from} → ${c.to}`),
  };
}

async function main() {
  const projectRoot = process.cwd();
  const files = await getFilesToProcess();

  if (files.length === 0) {
    console.log('No TypeScript files to process');
    return;
  }

  const results: FixResult[] = [];
  let totalFixed = 0;

  for (const file of files) {
    const result = processFile(file, projectRoot);
    if (result.fixed > 0) {
      results.push(result);
      totalFixed += result.fixed;
    }
  }

  // Output summary
  if (results.length > 0) {
    console.log(`\nFixed ${totalFixed} imports in ${results.length} files:\n`);
    for (const result of results) {
      console.log(`  ${result.file} (${result.fixed} imports)`);
      for (const imp of result.imports) {
        console.log(`    ${imp}`);
      }
    }
    console.log('');
  } else {
    console.log(`Checked ${files.length} files - all imports are correct`);
  }
}

main().catch((error) => {
  console.error('Error fixing imports:', error);
  process.exit(1);
});
