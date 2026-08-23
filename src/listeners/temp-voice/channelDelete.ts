import { Listener } from '@sapphire/framework';
import type { GuildChannel } from 'discord.js';
import { Events } from 'discord.js';
import { container } from '@sapphire/framework';
import { TempChannelService } from '../../modules/temp-voice/services/temp-channel.service.js';
import { TempVoiceConfigService } from '../../modules/temp-voice/services/config.service.js';
import { PermissionsService } from '../../modules/temp-voice/services/permissions.service.js';
import { UserPreferencesService } from '../../modules/temp-voice/services/user-preferences.service.js';

export class ChannelDeleteListener extends Listener {
  private configService!: TempVoiceConfigService;
  private channelService!: TempChannelService;
  private userPrefsService!: UserPreferencesService;

  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ChannelDelete,
    });
  }

  public async run(channel: GuildChannel): Promise<void> {
    // Initialize services (lazy initialization)
    if (!this.configService) {
      this.configService = new TempVoiceConfigService(container.prisma, container.client);
      this.channelService = new TempChannelService(container.prisma, new PermissionsService());
      this.userPrefsService = new UserPreferencesService(container.prisma);
    }

    try {
      // Check if this was a temp voice channel
      const tempChannel = await this.channelService.getByChannelId(channel.id);

      if (tempChannel) {
        // Save user preferences before deleting (if customization is allowed)
        const config = await this.configService.getOrNull(channel.guild.id);
        if (config?.allowCustomization) {
          await this.userPrefsService.saveFromChannel(channel.guild.id, tempChannel.ownerId, {
            customName: tempChannel.customName,
            customUserLimit: tempChannel.customUserLimit,
            customBitrate: tempChannel.customBitrate,
            customRegion: tempChannel.customRegion,
            isLocked: tempChannel.isLocked,
            isHidden: tempChannel.isHidden,
            allowedUserIds: (tempChannel.allowedUserIds as string[]) || [],
            deniedUserIds: (tempChannel.deniedUserIds as string[]) || [],
            trustedUserIds: (tempChannel.trustedUserIds as string[]) || [],
          });
        }

        // Clean up the database record
        await this.channelService.delete(channel.id);

        this.container.logger.info(
          `[TempVoice] Cleaned up database record for externally deleted channel ${channel.id}`
        );
      }
    } catch (error) {
      this.container.logger.error(
        `[TempVoice] Error handling channel deletion for ${channel.id}:`,
        error
      );
    }
  }
}
