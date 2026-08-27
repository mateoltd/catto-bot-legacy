import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMMAND_ROOT = resolve(process.cwd(), 'src/commands');

async function findCommandFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findCommandFiles(path);
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    })
  );
  return nested.flat();
}

describe('command transport contract', () => {
  it('gives every chat-input command a shared prefix transport', async () => {
    const files = await findCommandFiles(COMMAND_ROOT);
    const missing: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (!source.includes('registerChatInputCommand')) continue;

      const usesSharedTransport =
        source.includes('InteractionResponder') &&
        source.includes('MessageResponder') &&
        source.includes('messageRun');

      if (!usesSharedTransport) missing.push(relative(COMMAND_ROOT, file));
    }

    expect(missing).toEqual([]);
  });
});
