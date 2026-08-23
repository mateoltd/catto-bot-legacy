import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';
import { checkImportsInContent } from './lib/import-utils';

/**
 * Checks that all local imports in TypeScript files have .js extensions for ESM compatibility.
 *
 * Usage:
 *   tsx scripts/check-imports.ts                    # Check all files in src/
 *   tsx scripts/check-imports.ts src/index.ts       # Check specific file(s)
 *
 * Exit codes:
 *   0 - All imports are valid
 *   1 - Found invalid imports
 */

interface ImportError {
  file: string;
  line: number;
  importPath: string;
  suggestion: string;
  reason: string;
}

async function getFilesToProcess(): Promise<string[]> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const files: string[] = [];
    for (const arg of args) {
      if (arg.includes('*')) {
        const matched = await fg(arg, { absolute: true, onlyFiles: true });
        files.push(...matched.filter((f) => f.endsWith('.ts')));
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

function checkFile(file: string, projectRoot: string): ImportError[] {
  const content = readFileSync(file, 'utf-8');
  const relativeFile = file.replace(projectRoot, '').replace(/\\/g, '/').replace(/^\//, '');

  return checkImportsInContent(content, file, projectRoot).map((err) => ({
    file: relativeFile,
    line: err.line,
    importPath: err.importPath,
    suggestion: err.suggestion,
    reason: err.reason,
  }));
}

async function main() {
  const projectRoot = process.cwd();
  const files = await getFilesToProcess();

  if (files.length === 0) {
    console.log('No TypeScript files to check');
    return;
  }

  const allErrors: ImportError[] = [];
  for (const file of files) {
    allErrors.push(...checkFile(file, projectRoot));
  }

  if (allErrors.length > 0) {
    console.error(`\nFound ${allErrors.length} import issues:\n`);

    const errorsByFile = new Map<string, ImportError[]>();
    for (const error of allErrors) {
      const existing = errorsByFile.get(error.file) || [];
      existing.push(error);
      errorsByFile.set(error.file, existing);
    }

    for (const [file, errors] of errorsByFile) {
      console.error(`  ${file}`);
      for (const error of errors) {
        console.error(`    Line ${error.line}: '${error.importPath}'`);
        console.error(`      ${error.reason}`);
        console.error(`      Suggestion: '${error.suggestion}'`);
      }
      console.error('');
    }

    console.error(`Run 'pnpm fix:imports' to automatically fix these issues\n`);
    process.exit(1);
  }

  console.log(`Checked ${files.length} files - all imports are valid`);
}

main().catch((error) => {
  console.error('Error checking imports:', error);
  process.exit(1);
});
