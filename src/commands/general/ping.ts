import { Command } from '@sapphire/framework';
import { type Message } from 'discord.js';
import { resolveKey } from '@sapphire/plugin-i18next';
import { ApplyOptions } from '@sapphire/decorators';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';

@ApplyOptions<Command.Options>({
  name: 'ping',
  aliases: ['pong'],
  description: 'Check the bot latency',
  detailedDescription: "Returns the bot's websocket ping and API latency.",
  preconditions: ['GuildOnly'],
})
export class PingCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return this.run(new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message) {
    if (!message.inGuild()) return;
    return this.run(new MessageResponder(message));
  }

  private async run(ctx: CommandResponder) {
    const startedAt = Date.now();
    await ctx.deferClassic();

    return ctx.editReply({
      content: await resolveKey(ctx.guild, 'commands/ping:content', {
        latency: Date.now() - startedAt,
        apiLatency: Math.round(this.container.client.ws.ping),
      }),
    });
  }
}
