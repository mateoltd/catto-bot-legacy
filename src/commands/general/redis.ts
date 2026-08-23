import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { pingRedis, getRedisInfo } from '#lib/redis.js';

@ApplyOptions<Command.Options>({
  name: 'redis',
  description: 'Check Redis connection and stats',
  preconditions: ['OwnerOnly'],
  cooldownDelay: 10_000,
})
export class RedisCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Ping Redis
      const pingStart = Date.now();
      const pong = await pingRedis();
      const pingTime = Date.now() - pingStart;

      // Get Redis info
      const info = await getRedisInfo();

      // Parse useful info
      const lines = info.split('\r\n');
      const version = lines.find((l) => l.startsWith('redis_version:'))?.split(':')[1] || 'Unknown';
      const uptime = lines.find((l) => l.startsWith('uptime_in_seconds:'))?.split(':')[1] || '0';
      const connectedClients =
        lines.find((l) => l.startsWith('connected_clients:'))?.split(':')[1] || '0';
      const usedMemory =
        lines.find((l) => l.startsWith('used_memory_human:'))?.split(':')[1] || 'Unknown';
      const totalKeys =
        lines
          .find((l) => l.startsWith('db0:'))
          ?.split('keys=')[1]
          ?.split(',')[0] || '0';

      const uptimeHours = Math.floor(parseInt(uptime) / 3600);
      const uptimeDays = Math.floor(uptimeHours / 24);

      const embed = new EmbedBuilder()
        .setTitle('📊 Redis Statistics')
        .setColor(0x00ff00)
        .addFields(
          { name: '🏓 Ping', value: `${pong} (${pingTime}ms)`, inline: true },
          { name: '📦 Version', value: version, inline: true },
          { name: '⏱️ Uptime', value: `${uptimeDays}d ${uptimeHours % 24}h`, inline: true },
          { name: '👥 Connected Clients', value: connectedClients, inline: true },
          { name: '💾 Memory Usage', value: usedMemory, inline: true },
          { name: '🔑 Total Keys', value: totalKeys, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Redis Error')
        .setDescription(
          `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        .setColor(0xff0000)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
