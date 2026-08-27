import { Command } from '@sapphire/framework';
import { type Message, EmbedBuilder, version as djsVersion } from 'discord.js';
import { version as sapphireVersion } from '@sapphire/framework';
import { version as typescriptVersion } from 'typescript';
import { formatUptime } from '#lib/utils.js';
import { COLORS } from '#lib/constants.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';

export class InfoCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'info',
      aliases: ['botinfo', 'stats'],
      description: 'Display bot information and statistics',
      detailedDescription:
        'Shows detailed information about the bot including version, uptime, and statistics.',
      preconditions: ['GuildOnly'],
    });
  }

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
    const { client } = this.container;
    await ctx.deferPublicClassic();

    const embed = new EmbedBuilder()
      .setColor(COLORS.DEFAULT)
      .setTitle('Bot Information')
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .addFields(
        {
          name: '📊 Statistics',
          value: [
            `**Guilds:** ${client.guilds.cache.size}`,
            `**Users:** ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`,
            `**Channels:** ${client.channels.cache.size}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '⚙️ System',
          value: [
            `**Uptime:** ${formatUptime(client.uptime ?? 0)}`,
            `**Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            `**Node.js:** ${process.version}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📚 Versions',
          value: [
            `**Discord.js:** v${djsVersion}`,
            `**Sapphire:** v${sapphireVersion}`,
            `**TypeScript:** v${typescriptVersion}`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({
        text: `Requested by ${ctx.user.tag}`,
        iconURL: ctx.user.displayAvatarURL(),
      })
      .setTimestamp();

    return ctx.editReply({ embeds: [embed] });
  }
}
