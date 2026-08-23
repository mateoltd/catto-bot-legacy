import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

/**
 * Shared utilities for ESM import validation and fixing.
 * These functions are used by both check-imports.ts and fix-imports.ts.
 */

/** Path alias mapping from tsconfig.json */
export const ALIAS_MAP: Record<string, string> = {
  '#lib/': 'src/lib/',
  '#root/': 'src/',
  '#structures/': 'src/structures/',
  '#commands/': 'src/commands/',
  '#listeners/': 'src/listeners/',
  '#routes/': 'src/routes/',
  '#preconditions/': 'src/preconditions/',
  '#modules/': 'src/modules/',
  '#config': 'src/config',
};

export interface ImportMatch {
  fullMatch: string;
  before: string;
  path: string;
  after: string;
  index: number;
}

/**
 * Checks if an import path is a local import (relative or alias).
 * Returns false for node_modules imports.
 */
export function isLocalImport(importPath: string): boolean {
  return importPath.startsWith('.') || importPath.startsWith('#');
}

/**
 * Checks if an import path ends with a directory separator.
 */
export function isDirectoryImport(importPath: string): boolean {
  return importPath.endsWith('/') || importPath.endsWith('\\');
}

/**
 * Removes .js extension from a path if present.
 */
export function stripJsExtension(path: string): string {
  return path.endsWith('.js') ? path.slice(0, -3) : path;
}

/**
 * Resolves an import path to an absolute filesystem path.
 */
export function resolveImportPath(
  importPath: string,
  currentFile: string,
  projectRoot: string
): string | null {
  const pathWithoutExt = stripJsExtension(importPath);

  if (pathWithoutExt.startsWith('.')) {
    return resolve(dirname(currentFile), pathWithoutExt);
  }

  if (pathWithoutExt.startsWith('#')) {
    for (const [alias, replacement] of Object.entries(ALIAS_MAP)) {
      if (pathWithoutExt.startsWith(alias) || pathWithoutExt === alias.slice(0, -1)) {
        const aliasPath = pathWithoutExt.replace(alias, replacement);
        return resolve(projectRoot, aliasPath);
      }
    }
  }

  return null;
}

/**
 * Determines the correct import path with proper .js extension.
 */
export function determineCorrectPath(
  originalPath: string,
  resolvedPath: string | null,
  checkExists: (path: string) => boolean = existsSync
): string {
  const pathWithoutExt = stripJsExtension(originalPath);

  if (!resolvedPath) {
    return originalPath.endsWith('.js') ? originalPath : `${pathWithoutExt}.js`;
  }

  const dirWithIndex = join(resolvedPath, 'index.ts');
  if (checkExists(dirWithIndex)) {
    return `${pathWithoutExt}/index.js`;
  }

  const tsFile = `${resolvedPath}.ts`;
  const tsxFile = `${resolvedPath}.tsx`;
  if (checkExists(tsFile) || checkExists(tsxFile)) {
    return `${pathWithoutExt}.js`;
  }

  return originalPath.endsWith('.js') ? originalPath : `${pathWithoutExt}.js`;
}

/**
 * Extracts all import matches from file content using a safe line-by-line approach.
 * This avoids catastrophic regex backtracking.
 */
export function extractImports(content: string): ImportMatch[] {
  const matches: ImportMatch[] = [];
  const lines = content.split('\n');

  let currentIndex = 0;
  let pendingImport: { startIndex: number; lines: string[] } | null = null;

  for (const line of lines) {
    const lineStart = currentIndex;

    // Check if we're continuing a multi-line import
    if (pendingImport) {
      pendingImport.lines.push(line);
      if (line.includes('from ') || line.includes('from\t')) {
        const fullText = pendingImport.lines.join('\n');
        const match = parseImportLine(fullText, pendingImport.startIndex);
        if (match) matches.push(match);
        pendingImport = null;
      }
    } else {
      // Check for import/export start
      const trimmed = line.trim();
      if ((trimmed.startsWith('import ') || trimmed.startsWith('export ')) &&
          !trimmed.startsWith('import(')) {
        if (trimmed.includes(' from ') || trimmed.includes('\tfrom\t')) {
          // Single line import
          const match = parseImportLine(line, lineStart);
          if (match) matches.push(match);
        } else if (!trimmed.endsWith(';')) {
          // Start of multi-line import
          pendingImport = { startIndex: lineStart, lines: [line] };
        }
      }

      // Check for dynamic imports: import('path') or await import('path')
      const dynamicMatch = parseDynamicImport(line, lineStart);
      if (dynamicMatch) matches.push(dynamicMatch);
    }

    currentIndex += line.length + 1; // +1 for newline
  }

  return matches;
}

/**
 * Parse a static import/export line
 */
function parseImportLine(text: string, startIndex: number): ImportMatch | null {
  // Match: import/export ... from 'path' or "path"
  const match = text.match(/^((?:import|export)\s+(?:type\s+)?[^'"]*from\s*['"])([^'"]+)(['"])/);
  if (!match) return null;

  const [fullMatch, before, path, after] = match;
  if (!isLocalImport(path) || isDirectoryImport(path)) return null;

  return { fullMatch, before, path, after, index: startIndex };
}

/**
 * Parse dynamic imports from a line
 */
function parseDynamicImport(line: string, lineStart: number): ImportMatch | null {
  // Match: import('path') or await import('path')
  const match = line.match(/((?:await\s+)?import\s*\(\s*['"])([^'"]+)(['"]\s*\))/);
  if (!match) return null;

  const [fullMatch, before, path, after] = match;
  if (!isLocalImport(path) || isDirectoryImport(path)) return null;

  const index = lineStart + (line.indexOf(fullMatch) || 0);
  return { fullMatch, before, path, after, index };
}

/**
 * Calculates the line number for a given index in content.
 */
export function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/**
 * Fixes all imports in the given content.
 */
export function fixImportsInContent(
  content: string,
  currentFile: string,
  projectRoot: string,
  checkExists: (path: string) => boolean = existsSync
): { content: string; changes: Array<{ from: string; to: string }> } {
  let result = content;
  const changes: Array<{ from: string; to: string }> = [];
  const maxIterations = 1000; // Safety limit
  let iterations = 0;

  let hasChanges = true;
  while (hasChanges && iterations < maxIterations) {
    hasChanges = false;
    iterations++;
    const imports = extractImports(result);

    for (const imp of imports) {
      const resolvedPath = resolveImportPath(imp.path, currentFile, projectRoot);
      const correctPath = determineCorrectPath(imp.path, resolvedPath, checkExists);

      if (correctPath !== imp.path) {
        const newImport = `${imp.before}${correctPath}${imp.after}`;
        result = result.replace(imp.fullMatch, newImport);
        changes.push({ from: imp.path, to: correctPath });
        hasChanges = true;
        break;
      }
    }
  }

  return { content: result, changes };
}

/**
 * Checks imports in content and returns validation errors.
 */
export function checkImportsInContent(
  content: string,
  currentFile: string,
  projectRoot: string,
  checkExists: (path: string) => boolean = existsSync
): Array<{
  line: number;
  importPath: string;
  suggestion: string;
  reason: string;
}> {
  const errors: Array<{
    line: number;
    importPath: string;
    suggestion: string;
    reason: string;
  }> = [];

  const imports = extractImports(content);

  for (const imp of imports) {
    const resolvedPath = resolveImportPath(imp.path, currentFile, projectRoot);
    const lineNumber = getLineNumber(content, imp.index);

    if (!imp.path.endsWith('.js')) {
      let suggestion = `${imp.path}.js`;

      if (resolvedPath) {
        const dirWithIndex = join(resolvedPath, 'index.ts');
        if (checkExists(dirWithIndex)) {
          suggestion = `${imp.path}/index.js`;
        }
      }

      errors.push({
        line: lineNumber,
        importPath: imp.path,
        suggestion,
        reason: 'Missing .js extension',
      });
      continue;
    }

    if (resolvedPath) {
      const pathWithoutJs = imp.path.slice(0, -3);
      const dirWithIndex = join(resolvedPath, 'index.ts');
      const directFile = `${resolvedPath}.ts`;

      if (checkExists(dirWithIndex) && !imp.path.endsWith('/index.js') && !checkExists(directFile)) {
        errors.push({
          line: lineNumber,
          importPath: imp.path,
          suggestion: `${pathWithoutJs}/index.js`,
          reason: 'Should import /index.js for directory with index.ts',
        });
      }
    }
  }

  return errors;
}
