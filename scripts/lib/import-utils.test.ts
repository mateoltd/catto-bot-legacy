import { describe, it, expect } from 'vitest';
import {
  isLocalImport,
  isDirectoryImport,
  stripJsExtension,
  resolveImportPath,
  determineCorrectPath,
  extractImports,
  getLineNumber,
  fixImportsInContent,
  checkImportsInContent,
  ALIAS_MAP,
} from './import-utils';

describe('isLocalImport', () => {
  it('identifies relative imports', () => {
    expect(isLocalImport('./foo')).toBe(true);
    expect(isLocalImport('../bar')).toBe(true);
  });

  it('identifies alias imports', () => {
    expect(isLocalImport('#lib/utils')).toBe(true);
    expect(isLocalImport('#config')).toBe(true);
  });

  it('rejects node_modules imports', () => {
    expect(isLocalImport('discord.js')).toBe(false);
    expect(isLocalImport('@sapphire/framework')).toBe(false);
    expect(isLocalImport('node:path')).toBe(false);
  });
});

describe('isDirectoryImport', () => {
  it('detects directory imports', () => {
    expect(isDirectoryImport('./utils/')).toBe(true);
    expect(isDirectoryImport('./utils')).toBe(false);
  });
});

describe('stripJsExtension', () => {
  it('removes .js extension', () => {
    expect(stripJsExtension('./foo.js')).toBe('./foo');
    expect(stripJsExtension('./foo')).toBe('./foo');
  });
});

describe('resolveImportPath', () => {
  const root = '/project';
  const file = '/project/src/lib/foo.ts';

  it('resolves relative imports', () => {
    const result = resolveImportPath('./bar', file, root);
    expect(result).toMatch(/project.*src.*lib.*bar$/);
  });

  it('resolves alias imports', () => {
    const result = resolveImportPath('#lib/utils', file, root);
    expect(result).toMatch(/project.*src.*lib.*utils$/);
  });

  it('returns null for node_modules', () => {
    expect(resolveImportPath('discord.js', file, root)).toBe(null);
  });
});

describe('determineCorrectPath', () => {
  const noExists = () => false;

  it('adds .js when missing', () => {
    expect(determineCorrectPath('./foo', null, noExists)).toBe('./foo.js');
  });

  it('keeps existing .js', () => {
    expect(determineCorrectPath('./foo.js', null, noExists)).toBe('./foo.js');
  });

  it('returns /index.js for directories', () => {
    const hasIndex = (p: string) => p.endsWith('utils/index.ts') || p.endsWith('utils\\index.ts');
    expect(determineCorrectPath('./utils', '/project/src/utils', hasIndex)).toBe('./utils/index.js');
  });
});

describe('extractImports', () => {
  it('extracts single-line imports', () => {
    const imports = extractImports(`import { foo } from './foo';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./foo');
  });

  it('extracts multi-line imports', () => {
    const content = `import {
  foo,
  bar,
} from './utils';`;
    const imports = extractImports(content);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./utils');
  });

  it('extracts dynamic imports', () => {
    const imports = extractImports(`const m = await import('./dynamic');`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./dynamic');
  });

  it('extracts dynamic imports without await', () => {
    const imports = extractImports(`import('./lazy').then(m => m.default);`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./lazy');
  });

  it('extracts export from', () => {
    const imports = extractImports(`export { foo } from './foo';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./foo');
  });

  it('extracts export * from', () => {
    const imports = extractImports(`export * from './types';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./types');
  });

  it('extracts type imports', () => {
    const imports = extractImports(`import type { Foo } from './types';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./types');
  });

  it('extracts default imports', () => {
    const imports = extractImports(`import Config from './config';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./config');
  });

  it('extracts namespace imports', () => {
    const imports = extractImports(`import * as utils from './utils';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./utils');
  });

  it('extracts alias path imports', () => {
    const imports = extractImports(`import { CONFIG } from '#config';`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('#config');
  });

  it('skips node_modules', () => {
    const imports = extractImports(`import { Client } from 'discord.js';`);
    expect(imports).toHaveLength(0);
  });

  it('skips scoped packages', () => {
    const imports = extractImports(`import { container } from '@sapphire/framework';`);
    expect(imports).toHaveLength(0);
  });

  it('skips directory imports', () => {
    const imports = extractImports(`import * from './utils/';`);
    expect(imports).toHaveLength(0);
  });

  it('handles empty content', () => {
    expect(extractImports('')).toHaveLength(0);
  });

  it('handles content without imports', () => {
    expect(extractImports('const x = 1;')).toHaveLength(0);
  });

  it('extracts multiple imports', () => {
    const content = `import { foo } from './foo';
import { bar } from './bar';
import { baz } from '#lib/baz';`;
    const imports = extractImports(content);
    expect(imports).toHaveLength(3);
  });

  it('handles double quotes', () => {
    const imports = extractImports(`import { foo } from "./foo";`);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.path).toBe('./foo');
  });
});

describe('getLineNumber', () => {
  it('returns correct line', () => {
    expect(getLineNumber('a\nb\nc', 0)).toBe(1);
    expect(getLineNumber('a\nb\nc', 2)).toBe(2);
  });
});

describe('fixImportsInContent', () => {
  const file = '/project/src/index.ts';
  const root = '/project';
  const noExists = () => false;

  it('adds .js extension', () => {
    const result = fixImportsInContent(`import { foo } from './foo';`, file, root, noExists);
    expect(result.content).toBe(`import { foo } from './foo.js';`);
    expect(result.changes).toHaveLength(1);
  });

  it('skips correct imports', () => {
    const result = fixImportsInContent(`import { foo } from './foo.js';`, file, root, noExists);
    expect(result.changes).toHaveLength(0);
  });

  it('fixes multiple imports', () => {
    const content = `import { foo } from './foo';
import { bar } from './bar';`;
    const result = fixImportsInContent(content, file, root, noExists);
    expect(result.content).toContain(`'./foo.js'`);
    expect(result.content).toContain(`'./bar.js'`);
    expect(result.changes).toHaveLength(2);
  });

  it('fixes multi-line imports', () => {
    const content = `import {
  foo,
  bar,
} from './utils';`;
    const result = fixImportsInContent(content, file, root, noExists);
    expect(result.content).toContain(`'./utils.js'`);
  });

  it('fixes dynamic imports', () => {
    const result = fixImportsInContent(`await import('./module');`, file, root, noExists);
    expect(result.content).toBe(`await import('./module.js');`);
  });

  it('fixes alias imports', () => {
    const result = fixImportsInContent(`import { CONFIG } from '#config';`, file, root, noExists);
    expect(result.content).toBe(`import { CONFIG } from '#config.js';`);
  });

  it('adds /index.js for directories', () => {
    // Mock that only matches the specific utils/index.ts path
    const hasIndex = (p: string) => p.endsWith('utils/index.ts') || p.endsWith('utils\\index.ts');
    const result = fixImportsInContent(`import { u } from './utils';`, file, root, hasIndex);
    expect(result.content).toBe(`import { u } from './utils/index.js';`);
  });

  it('does not modify node_modules', () => {
    const content = `import { Client } from 'discord.js';`;
    const result = fixImportsInContent(content, file, root, noExists);
    expect(result.content).toBe(content);
  });

  it('records changes correctly', () => {
    const result = fixImportsInContent(`import { foo } from './foo';`, file, root, noExists);
    expect(result.changes[0]).toEqual({ from: './foo', to: './foo.js' });
  });
});

describe('checkImportsInContent', () => {
  const file = '/project/src/index.ts';
  const root = '/project';
  const noExists = () => false;

  it('reports missing .js', () => {
    const errors = checkImportsInContent(`import { foo } from './foo';`, file, root, noExists);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.suggestion).toBe('./foo.js');
    expect(errors[0]?.reason).toBe('Missing .js extension');
  });

  it('passes correct imports', () => {
    const errors = checkImportsInContent(`import { foo } from './foo.js';`, file, root, noExists);
    expect(errors).toHaveLength(0);
  });

  it('reports multiple errors', () => {
    const content = `import { foo } from './foo';
import { bar } from './bar';`;
    const errors = checkImportsInContent(content, file, root, noExists);
    expect(errors).toHaveLength(2);
  });

  it('suggests /index.js for directories', () => {
    const hasIndex = (p: string) => p.endsWith('utils/index.ts') || p.endsWith('utils\\index.ts');
    const errors = checkImportsInContent(`import { u } from './utils';`, file, root, hasIndex);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.suggestion).toBe('./utils/index.js');
  });

  it('reports correct line numbers', () => {
    const content = `import { foo } from './foo.js';

import { bar } from './bar';`;
    const errors = checkImportsInContent(content, file, root, noExists);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(3);
  });

  it('does not report node_modules', () => {
    const errors = checkImportsInContent(`import { Client } from 'discord.js';`, file, root, noExists);
    expect(errors).toHaveLength(0);
  });

  it('checks dynamic imports', () => {
    const errors = checkImportsInContent(`await import('./module');`, file, root, noExists);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.importPath).toBe('./module');
  });

  it('checks alias imports', () => {
    const errors = checkImportsInContent(`import { CONFIG } from '#config';`, file, root, noExists);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.suggestion).toBe('#config.js');
  });

  it('returns empty for fully valid file', () => {
    const content = `import { foo } from './foo.js';
import { Client } from 'discord.js';`;
    const errors = checkImportsInContent(content, file, root, noExists);
    expect(errors).toHaveLength(0);
  });
});

describe('ALIAS_MAP', () => {
  it('has expected aliases', () => {
    expect(ALIAS_MAP['#lib/']).toBe('src/lib/');
    expect(ALIAS_MAP['#config']).toBe('src/config');
  });
});
