import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
  ApplicationCommandType,
  InteractionContextType,
  type ContextMenuCommandInteraction,
} from 'discord.js';
import { Gate } from '#lib/validation/Gate.js';
import { encodeEvidenceCaptureModalCustomId } from '#modules/moderation/discord/customId.js';
import { errorContainer, formModal, EMOJI } from '#lib/discord/index.js';

@ApplyOptions<Command.Options>({
  name: 'Capture Evidence',
})
export class CaptureEvidenceCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerContextMenuCommand((builder) =>
      builder
        .setName('Capture Evidence')
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild)
    );
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    const gate = Gate.from(interaction);
    if (!gate) {
      await interaction.reply({
        components: [
          errorContainer()
            .h2(`${EMOJI.STATUS.ERROR} Server Only`)
            .text('This command can only be used in a server.')
            .build(),
        ],
        flags: 64, // Ephemeral
      });
      return;
    }

    if (!(await gate.requireAuth('mod.evidence.capture'))) return;

    const targetMessage = interaction.isMessageContextMenuCommand()
      ? interaction.targetMessage
      : null;

    if (!targetMessage) {
      await interaction.reply({
        components: [
          errorContainer()
            .h2(`${EMOJI.STATUS.ERROR} Error`)
            .text('Could not find the target message.')
            .build(),
        ],
        flags: 64,
      });
      return;
    }

    const customId = encodeEvidenceCaptureModalCustomId(targetMessage.id, targetMessage.channelId);

    const modal = formModal(customId, 'Capture Evidence', [
      {
        id: 'case_number',
        label: 'Case Number (optional — existing cases only)',
        placeholder: 'Leave empty to create a new case with the mod action',
        required: false,
        maxLength: 10,
      },
      {
        id: 'capture_range',
        label: 'Capture Range (optional)',
        placeholder: 'Empty = this message | Number = next N msgs | Or paste a link',
        required: false,
      },
      {
        id: 'delete_messages',
        label: 'Delete messages after capture? (yes/no)',
        placeholder: 'yes (default)',
        required: false,
        maxLength: 3,
      },
    ]);

    await interaction.showModal(modal);
  }
}
