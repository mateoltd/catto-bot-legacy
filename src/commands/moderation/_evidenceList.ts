import type { Guild } from 'discord.js';
import { container } from '@sapphire/framework';
import type { CommandResponder } from '#lib/discord/index.js';
import { Gate } from '#lib/validation/Gate.js';
import { evidenceService } from '#modules/moderation/services/EvidenceService.js';
import {
  container as fluentContainer,
  EMOJI,
  COLORS,
  formatRelativeTimestamp,
  formatStatsLine,
} from '#lib/discord/index.js';

export interface EvidenceListOptions {
  caseNumber: number;
  guild: Guild;
  guildId: string;
}

/** Human-readable evidence type labels */
const TYPE_LABELS: Record<string, string> = {
  IMAGE: 'Images',
  VIDEO: 'Videos',
  AUDIO: 'Audio',
  DOCUMENT: 'Documents',
  URL: 'URLs',
  DISCORD_URL: 'Discord Links',
  MESSAGE_SNAPSHOT: 'Snapshots',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function handleEvidenceList(options: EvidenceListOptions, ctx: CommandResponder) {
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  if (!(await gate.requireAuth('mod.evidence.list', ctx))) return;

  await ctx.defer();

  try {
    // Verify case exists
    const modCase = await container.prisma.modCase.findFirst({
      where: { guildId: gate.guild.id, caseNumber: options.caseNumber },
    });

    if (!modCase) {
      await ctx.editReply(
        fluentContainer({ color: COLORS.ERROR })
          .h2(`${EMOJI.STATUS.ERROR} Case Not Found`)
          .text(`Case #${options.caseNumber} was not found in this server.`)
      );
      return;
    }

    // Get evidence summary
    const summary = await evidenceService.getEvidenceSummary(gate.guild.id, options.caseNumber);

    if (summary.total === 0) {
      const dashboardUrl = evidenceService.generateEvidenceListUrl(
        gate.guild.id,
        options.caseNumber
      );

      const result = fluentContainer({ color: COLORS.INFO })
        .h2(`${EMOJI.MODERATION.ICONS.SHIELD_BLUE} Evidence for Case #${options.caseNumber}`)
        .text('No evidence has been added to this case yet.')
        .linkButtons({ url: dashboardUrl, label: 'Add Evidence' });

      await ctx.editReply(result);
      return;
    }

    // Build type breakdown
    const typeBreakdown: Record<string, number> = {};
    for (const [type, count] of Object.entries(summary.byType)) {
      if (count && count > 0) {
        typeBreakdown[TYPE_LABELS[type] ?? type] = count;
      }
    }

    const dashboardUrl = evidenceService.generateEvidenceListUrl(gate.guild.id, options.caseNumber);

    const result = fluentContainer({ color: COLORS.INFO })
      .h2(`${EMOJI.MODERATION.ICONS.SHIELD_BLUE} Evidence for Case #${options.caseNumber}`)
      .text(formatStatsLine({ Total: summary.total, ...typeBreakdown }));

    if (summary.totalSizeBytes > 0) {
      result.text(`${EMOJI.STATUS.INFO} **Total size:** ${formatBytes(summary.totalSizeBytes)}`);
    }

    if (summary.latestAt) {
      result.text(`${EMOJI.TIME.CLOCK} **Latest:** ${formatRelativeTimestamp(summary.latestAt)}`);
    }

    if (summary.hasWeakEvidenceOnly) {
      result
        .separator()
        .text(
          `${EMOJI.STATUS.WARNING} **Warning:** This case only has Discord message links as evidence. These may become unavailable if messages are deleted. Consider adding stronger evidence (screenshots, files).`
        );
    }

    result.linkButtons(
      { url: dashboardUrl, label: 'View in Dashboard' },
      { url: dashboardUrl, label: 'Add Evidence' }
    );

    result.footer('Evidence files and content are only viewable in the dashboard.');

    await ctx.editReply(result);
  } catch (error) {
    ctx.client.logger.error('Error in evidence list command:', error);
    await ctx
      .editReply(
        fluentContainer({ color: COLORS.ERROR })
          .h2(`${EMOJI.STATUS.ERROR} Error`)
          .text('An unexpected error occurred.')
      )
      .catch(() => {});
  }
}
