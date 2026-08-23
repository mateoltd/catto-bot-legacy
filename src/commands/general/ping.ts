import { Command } from '@sapphire/framework';
import { type Message } from 'discord.js';
import { buildInfoEmbed } from '#lib/utils.js';
import { resolveKey } from '@sapphire/plugin-i18next';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
  name: 'ping',
  aliases: ['pong'],
  description: 'Check the bot latency',
  detailedDescription: "Returns the bot's websocket ping and API latency.",
})
export class PingCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const msg = await interaction.reply({
      content: await resolveKey(interaction, 'commands/ping:content', {
        latency: '...',
        apiLatency: Math.round(this.container.client.ws.ping),
      }),
      ephemeral: true,
      fetchReply: true,
    });

    const latency = msg.createdTimestamp - interaction.createdTimestamp;

    return interaction.editReply({
      content: await resolveKey(interaction, 'commands/ping:content', {
        latency,
        apiLatency: Math.round(this.container.client.ws.ping),
      }),
    });
  }

  public override async messageRun(message: Message) {
    if (!message.channel.isSendable()) {
      return;
    }

    const msg = await message.channel.send('Pinging...');

    const embed = buildInfoEmbed(
      [
        `🏓 Pong!`,
        `**Bot Latency:** ${Math.round(this.container.client.ws.ping)}ms`,
        `**API Latency:** ${msg.createdTimestamp - message.createdTimestamp}ms`,
      ].join('\n'),
      { title: 'Ping Statistics' }
    );

    return msg.edit({ content: null, embeds: [embed] });
  }
}
