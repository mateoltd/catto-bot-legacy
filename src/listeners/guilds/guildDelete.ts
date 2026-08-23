import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Guild } from 'discord.js';
import { Prisma } from '@prisma/client';

@ApplyOptions<Listener.Options>({
  event: 'guildDelete',
})
export class GuildDeleteListener extends Listener {
  public override async run(guild: Guild) {
    this.container.logger.info(`Left guild: ${guild.name} (${guild.id})`);

    try {
      // Remove guild from database (cascade will remove related data)
      await this.container.prisma.guild.delete({
        where: { guildId: guild.id },
      });

      this.container.logger.info(`Successfully removed guild ${guild.name} from database`);
    } catch (error) {
      this.container.logger.error('Failed to remove guild from database:', error);
    }

    // Log the event
    await this.container.prisma.log
      .create({
        data: {
          level: 'info',
          message: `Bot left guild: ${guild.name}`,
          metadata: {
            guildId: guild.id,
            guildName: guild.name,
          } satisfies Prisma.JsonObject,
        },
      })
      .catch((err) => this.container.logger.error('Failed to log guild delete:', err));
  }
}
