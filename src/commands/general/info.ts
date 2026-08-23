import { Command } from '@sapphire/framework';
import { type Message, EmbedBuilder, version as djsVersion } from 'discord.js';
import { version as sapphireVersion } from '@sapphire/framework';
import { formatUptime } from '#lib/utils.js';
import { COLORS } from '#lib/constants.js';

export class InfoCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'info',
      aliases: ['botinfo', 'stats'],
      description: 'Display bot information and statistics',
      detailedDescription:
        'Shows detailed information about the bot including version, uptime, and statistics.',
    });
  }

  public override async messageRun(message: Message) {
    const { client } = this.container;

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
            `**TypeScript:** v${require('typescript').version}`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({
        text: `Requested by ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    if (!message.channel.isSendable()) {
      return;
    }

    return message.channel.send({ embeds: [embed] });
  }
}
