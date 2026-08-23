import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Guild } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: 'guildUpdate',
})
export class GuildUpdateListener extends Listener {
  public override async run(oldGuild: Guild, newGuild: Guild) {
    // Only update if name changed
    if (oldGuild.name !== newGuild.name) {
      this.container.logger.info(`Guild name changed: ${oldGuild.name} -> ${newGuild.name}`);

      try {
        await this.container.prisma.guild.update({
          where: { guildId: newGuild.id },
          data: {
            name: newGuild.name,
            updatedAt: new Date(),
          },
        });

        this.container.logger.info(`Updated guild ${newGuild.name} in database`);
      } catch (error) {
        this.container.logger.error('Failed to update guild in database:', error);
      }
    }
  }
}
