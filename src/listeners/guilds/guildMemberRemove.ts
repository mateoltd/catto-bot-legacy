import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { GuildMember, PartialGuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: 'guildMemberRemove',
})
export class GuildMemberRemoveListener extends Listener {
  public override async run(member: GuildMember | PartialGuildMember) {
    this.container.logger.debug(`Member left: ${member.user.username} from ${member.guild.name}`);

    try {
      // Optionally remove user from database or just unlink from guild
      // For now, we'll just unlink them from the guild
      await this.container.prisma.user.updateMany({
        where: {
          userId: member.user.id,
          guild: {
            guildId: member.guild.id,
          },
        },
        data: {
          guildId: null,
        },
      });

      this.container.logger.debug(`Unlinked user ${member.user.username} from guild`);
    } catch (error) {
      this.container.logger.error('Failed to update user in database:', error);
    }
  }
}
