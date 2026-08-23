import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: 'messageCreate',
})
export class MessageCreateListener extends Listener {
  public override async run(message: Message) {
    // Skip bot messages
    if (message.author.bot) return;

    // Only process guild messages
    if (!message.guild) return;

    try {
      // Ensure guild exists in database
      await this.container.prisma.guild.upsert({
        where: { guildId: message.guild.id },
        update: {},
        create: {
          guildId: message.guild.id,
          name: message.guild.name,
          language: 'en-US',
        },
      });

      // Ensure user exists in database
      const guild = await this.container.prisma.guild.findUnique({
        where: { guildId: message.guild.id },
      });

      if (guild) {
        await this.container.prisma.user.upsert({
          where: { userId: message.author.id },
          update: {
            username: message.author.username,
            updatedAt: new Date(),
          },
          create: {
            userId: message.author.id,
            username: message.author.username,
            guildId: guild.id,
          },
        });
      }
    } catch (error) {
      this.container.logger.error('Failed to process message for database:', error);
    }
  }
}
