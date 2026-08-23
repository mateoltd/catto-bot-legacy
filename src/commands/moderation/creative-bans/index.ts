/**
 * Creative Bans — Prefix-only command index
 *
 * Five theatrical ban commands available only via prefix (messageRun).
 * Feature-flagged to guild 790289803219566633.
 *
 * Commands:
 *   !captcha @user       — Impossible captcha verification
 *   !quicksand @user     — Messages degrade and user "sinks"
 *   !ctrl-z @user        — Undo the user's server presence
 *   !missile-strike @user — VC-only air raid
 *   !eject @user         — VC-only Among Us ejection
 */

import { Command, Args } from '@sapphire/framework';
import { type Message, type GuildMember } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';
import {
  isCreativeBansEnabled,
  resolveTarget,
  checkCreativePermission,
  checkBotBanPermission,
  canModerateTarget,
} from './_shared.js';
import { executeCaptcha } from './_captcha.js';
import { executeQuicksand } from './_quicksand.js';
import { executeCtrlZ } from './_ctrl-z.js';
import { executeMissileStrike } from './_missile-strike.js';
import { executeEject } from './_eject.js';

@ApplyOptions<Command.Options>({
  name: 'captcha',
  description: 'Creative ban: verificación de captcha imposible',
  preconditions: ['GuildOnly'],
})
export class CaptchaCommand extends Command {
  // No registerApplicationCommands — prefix only

  public override async messageRun(message: Message, args: Args) {
    await runCreativeBan(message, args, 'mod.creative.captcha', executeCaptcha);
  }
}

@ApplyOptions<Command.Options>({
  name: 'quicksand',
  description: 'Creative ban: arenas movedizas',
  preconditions: ['GuildOnly'],
})
export class QuicksandCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    await runCreativeBan(message, args, 'mod.creative.quicksand', executeQuicksand);
  }
}

@ApplyOptions<Command.Options>({
  name: 'ctrl-z',
  aliases: ['ctrlz', 'undo'],
  description: 'Creative ban: deshacer al usuario',
  preconditions: ['GuildOnly'],
})
export class CtrlZCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    await runCreativeBan(message, args, 'mod.creative.ctrl-z', executeCtrlZ);
  }
}

@ApplyOptions<Command.Options>({
  name: 'missile-strike',
  aliases: ['missilestrike', 'missile'],
  description: 'Creative ban: ataque con misiles (VC)',
  preconditions: ['GuildOnly'],
})
export class MissileStrikeCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    await runCreativeBan(message, args, 'mod.creative.missile-strike', executeMissileStrike);
  }
}

@ApplyOptions<Command.Options>({
  name: 'eject',
  aliases: ['amongus', 'sus'],
  description: 'Creative ban: expulsión Among Us (VC)',
  preconditions: ['GuildOnly'],
})
export class EjectCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    await runCreativeBan(message, args, 'mod.creative.eject', executeEject);
  }
}

// ============================================================================
// Shared runner
// ============================================================================

type CreativeBanExecutor = (message: Message, target: GuildMember) => Promise<void>;

/**
 * Shared validation and execution pipeline for all creative ban commands.
 */
async function runCreativeBan(
  message: Message,
  args: Args,
  permissionKey: string,
  executor: CreativeBanExecutor
): Promise<void> {
  const guild = message.guild;
  if (!guild || !message.member || !message.channel.isSendable()) return;

  // Feature flag check
  if (!isCreativeBansEnabled(guild.id)) {
    await message.channel.send('❌ Esta función no está disponible en este servidor.');
    return;
  }

  // Permission check via Gate
  const hasPermission = await checkCreativePermission(message.member as GuildMember, permissionKey);
  if (!hasPermission) {
    await message.channel.send('❌ No tienes permiso para usar este comando.');
    return;
  }

  // Bot permission check
  if (!checkBotBanPermission(guild)) {
    await message.channel.send('❌ No tengo permiso para banear miembros.');
    return;
  }

  // Parse target
  const rawArgs = await args.rest('string').catch(() => '');
  const target = await resolveTarget(message, rawArgs);
  if (!target) return;

  // Hierarchy check
  const hierarchyError = canModerateTarget(message.member as GuildMember, target);
  if (hierarchyError) {
    await message.channel.send(`❌ ${hierarchyError}`);
    return;
  }

  // Execute the creative ban
  await executor(message, target);
}
