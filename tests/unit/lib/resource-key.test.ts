import type { Message } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { resolveMessageCommandKey } from '../../../src/lib/validation/resourceKey.js';

function message(content: string): Message {
  return { content } as Message;
}

describe('message command resource keys', () => {
  it.each([
    ['panel', '!panel @user', 'mod.panel'],
    ['mutes', '!mutes @user voice', 'mod.mutes'],
    ['void', '!void 42', 'mod.void'],
  ])('maps the %s shortcut to its canonical moderation resource', (name, content, expected) => {
    expect(resolveMessageCommandKey(name, message(content))).toBe(expected);
  });

  it('keeps scoped moderation commands canonical', () => {
    expect(resolveMessageCommandKey('mod', message('!mod context @user 24h'))).toBe('mod.context');
  });
});
