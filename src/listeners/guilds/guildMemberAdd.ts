import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { GuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: 'guildMemberAdd',
})
export class GuildMemberAddListener extends Listener {
  public override async run(member: GuildMember) {
    this.container.logger.debug(
      `New member joined: ${member.user.username} in ${member.guild.name}`
    );

    try {
      // Get or create guild
      const guild = await this.container.prisma.guild.upsert({
        where: { guildId: member.guild.id },
        update: {},
        create: {
          guildId: member.guild.id,
          name: member.guild.name,
          language: 'en-US',
        },
      });

      // Add user to database
      await this.container.prisma.user.upsert({
        where: { userId: member.user.id },
        update: {
          username: member.user.username,
          guildId: guild.id,
          updatedAt: new Date(),
        },
        create: {
          userId: member.user.id,
          username: member.user.username,
          guildId: guild.id,
        },
      });

      this.container.logger.debug(`Added user ${member.user.username} to database`);
    } catch (error) {
      this.container.logger.error('Failed to add user to database:', error);
    }
  }
}
