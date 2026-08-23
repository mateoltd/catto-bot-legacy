import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { User } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: 'userUpdate',
})
export class UserUpdateListener extends Listener {
  public override async run(oldUser: User, newUser: User) {
    // Only update if username changed
    if (oldUser.username !== newUser.username) {
      this.container.logger.debug(`Username changed: ${oldUser.username} -> ${newUser.username}`);

      try {
        await this.container.prisma.user.updateMany({
          where: { userId: newUser.id },
          data: {
            username: newUser.username,
            updatedAt: new Date(),
          },
        });

        this.container.logger.debug(`Updated username for ${newUser.username} in database`);
      } catch (error) {
        this.container.logger.error('Failed to update user in database:', error);
      }
    }
  }
}
