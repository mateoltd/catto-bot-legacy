/**
 * Lazy singleton container for temp voice services.
 * Eliminates re-instantiation on every job/interaction.
 */

import { container } from '@sapphire/framework';
import { TempVoiceConfigService } from './config.service.js';
import { TempChannelService } from './temp-channel.service.js';
import { PermissionsService } from './permissions.service.js';
import { ControlPanelService } from './control-panel.service.js';
import { UserPreferencesService } from './user-preferences.service.js';
import { ChannelOperationsService } from './operations.service.js';

export interface TempVoiceServices {
  config: TempVoiceConfigService;
  channels: TempChannelService;
  permissions: PermissionsService;
  userPrefs: UserPreferencesService;
  controlPanel: ControlPanelService;
  operations: ChannelOperationsService;
}

let _instance: TempVoiceServices | null = null;

/**
 * Get the shared temp voice services singleton.
 * Lazily initializes on first call (container.prisma/client must be ready).
 */
export function getTempVoiceServices(): TempVoiceServices {
  if (!_instance) {
    const config = new TempVoiceConfigService(container.prisma, container.client);
    const permissions = new PermissionsService();
    const channels = new TempChannelService(container.prisma, permissions);
    const userPrefs = new UserPreferencesService(container.prisma);
    const controlPanel = new ControlPanelService(container.client, channels);
    const operations = new ChannelOperationsService(
      channels,
      config,
      permissions,
      userPrefs,
      controlPanel
    );

    _instance = { config, channels, permissions, userPrefs, controlPanel, operations };
  }

  return _instance;
}
