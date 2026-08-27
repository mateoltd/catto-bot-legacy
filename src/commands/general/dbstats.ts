import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { resolveKey } from '@sapphire/plugin-i18next';
import type { Message } from 'discord.js';
import { getStats } from '#lib/database.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';

@ApplyOptions<Command.Options>({
  description: 'Shows database statistics',
  requiredUserPermissions: ['Administrator'],
  preconditions: ['GuildOnly'],
})
export class DBStatsCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return this.run(new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message) {
    return this.run(new MessageResponder(message as Message<true>));
  }

  private async run(ctx: CommandResponder): Promise<void> {
    await ctx.deferPublicClassic();

    try {
      const stats = await getStats();

      await ctx.editReply({
        embeds: [
          {
            title: await resolveKey(ctx.guild, 'commands/general:dbstats.title'),
            color: 0x5865f2,
            fields: [
              {
                name: await resolveKey(ctx.guild, 'commands/general:dbstats.guilds'),
                value: stats.guilds.toString(),
                inline: true,
              },
              {
                name: await resolveKey(ctx.guild, 'commands/general:dbstats.users'),
                value: stats.users.toString(),
                inline: true,
              },
              {
                name: await resolveKey(ctx.guild, 'commands/general:dbstats.logs'),
                value: stats.logs.toString(),
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      this.container.logger.error('Failed to fetch database stats:', error);
      await ctx.editReply({
        content: await resolveKey(ctx.guild, 'commands/general:dbstats.error'),
      });
    }
  }
}
