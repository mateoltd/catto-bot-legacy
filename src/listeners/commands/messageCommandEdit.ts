import { Listener, Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message, PartialMessage } from 'discord.js';

/** Per-message cooldown to avoid rapid re-processing (ms). */
const COOLDOWN_MS = 3_000;
const recentEdits = new Map<string, number>();

@ApplyOptions<Listener.Options>({
  event: 'messageUpdate',
})
export class MessageCommandEditListener extends Listener {
  public override async run(old: Message | PartialMessage, updated: Message | PartialMessage) {
    // Resolve partial if needed
    if (updated.partial) {
      try {
        updated = await updated.fetch();
      } catch (err) {
        this.container.logger.debug('messageCommandEdit: failed to fetch partial message:', err);
        return;
      }
    }

    // Ignore bots and DMs
    if (!updated.guild || updated.author.bot || updated.webhookId) return;
    // Content must have actually changed
    if (!updated.content || old.content === updated.content) return;

    // Cooldown check
    const now = Date.now();
    const last = recentEdits.get(updated.id);
    if (last && now - last < COOLDOWN_MS) return;
    recentEdits.set(updated.id, now);

    // Periodically prune stale entries
    if (recentEdits.size > 500) {
      for (const [id, ts] of recentEdits) {
        if (now - ts > COOLDOWN_MS) recentEdits.delete(id);
      }
    }

    // Re-emit through Sapphire's message command pipeline
    this.container.client.emit(Events.PreMessageParsed, updated);
  }
}
