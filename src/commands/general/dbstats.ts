import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { resolveKey } from '@sapphire/plugin-i18next';
import { getStats } from '#lib/database.js';

@ApplyOptions<Command.Options>({
  description: 'Shows database statistics',
  requiredUserPermissions: ['Administrator'],
})
export class DBStatsCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const stats = await getStats();

      await interaction.editReply({
        embeds: [
          {
            title: await resolveKey(interaction, 'commands/general:dbstats.title'),
            color: 0x5865f2,
            fields: [
              {
                name: await resolveKey(interaction, 'commands/general:dbstats.guilds'),
                value: stats.guilds.toString(),
                inline: true,
              },
              {
                name: await resolveKey(interaction, 'commands/general:dbstats.users'),
                value: stats.users.toString(),
                inline: true,
              },
              {
                name: await resolveKey(interaction, 'commands/general:dbstats.logs'),
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
      await interaction.editReply({
        content: await resolveKey(interaction, 'commands/general:dbstats.error'),
      });
    }
  }
}
