import { describe, expect, it, vi } from 'vitest';
import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { InteractionResponder, MessageResponder } from '../../../src/lib/discord/core/responder.js';

function makeInteraction() {
  return {
    guild: { id: 'guild' },
    member: { id: 'member' },
    channelId: 'channel',
    user: { id: 'user' },
    client: {},
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue({ id: 'reply' }),
  };
}

function makeMessage() {
  const sent = {
    id: 'sent',
    edit: vi.fn().mockResolvedValue({ id: 'edited' }),
  };
  const channel = {
    sendTyping: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(sent),
  };

  return {
    message: {
      guild: { id: 'guild' },
      member: { id: 'member' },
      channelId: 'channel',
      channel,
      author: { id: 'user' },
      client: {},
    },
    channel,
    sent,
  };
}

describe('CommandResponder', () => {
  it('sends classic interaction payloads through the shared transport', async () => {
    const interaction = makeInteraction();
    const responder = new InteractionResponder(interaction as never);

    await responder.deferClassic();
    await responder.deferPublicClassic();
    await responder.reply({ content: 'hello' });
    await responder.editReply({ embeds: [{ description: 'done' }] });

    expect(interaction.deferReply).toHaveBeenNthCalledWith(1, { flags: 64 });
    expect(interaction.deferReply).toHaveBeenNthCalledWith(2);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'hello',
      flags: 64,
      allowedMentions: { parse: [] },
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [{ description: 'done' }],
      allowedMentions: { parse: [] },
    });
  });

  it('preserves the Components V2 path for container responses', async () => {
    const interaction = makeInteraction();
    const responder = new InteractionResponder(interaction as never);
    const component = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent('hello')
    );

    await responder.reply(component);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [component],
        allowedMentions: { parse: [] },
      })
    );
  });

  it('maps classic replies and edits onto a message channel', async () => {
    const { message, channel, sent } = makeMessage();
    const responder = new MessageResponder(message as never);

    await responder.deferClassic();
    await responder.reply({ content: 'hello' });
    await responder.editReply({ content: 'first' });
    await responder.editReply({ content: 'updated' });

    expect(channel.sendTyping).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenNthCalledWith(1, {
      content: 'hello',
      allowedMentions: { parse: [] },
    });
    expect(channel.send).toHaveBeenNthCalledWith(2, {
      content: 'first',
      allowedMentions: { parse: [] },
    });
    expect(sent.edit).toHaveBeenCalledWith({
      content: 'updated',
      allowedMentions: { parse: [] },
    });
  });
});
