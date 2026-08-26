import { createHash } from "node:crypto";

import { container } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type Client,
  type DMChannel,
  type GuildMember,
  type Message,
  type VoiceChannel,
} from "discord.js";
import {
  TempVoiceDeliveryKind,
  TempVoiceDeliveryStatus,
  type PrismaClient,
  type TempVoiceDelivery,
} from "@prisma/client";

import { encodeCustomId } from "#lib/discord/core/index.js";
import { EMOJI } from "#lib/discord/design/index.js";
import { container as fluentContainer } from "#lib/discord/containers/container.js";

import { TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH } from "../constants.js";
import {
  hasCurrentTempVoiceOwner,
  isCurrentTempVoiceOwner,
  TempVoiceLifecycleState,
  TempVoiceOwnershipState,
  type TempVoiceRecord,
} from "../domain/temp-voice.types.js";
import type {
  TempVoiceProjection,
  TempVoiceProjectionOptions,
} from "../ports/temp-voice-projection.port.js";
import { classifyDiscordError } from "./discord-error-classifier.js";

export class TempVoiceDiscordProjector implements TempVoiceProjection {
  public constructor(
    private readonly client: Client,
    private readonly prisma: PrismaClient,
  ) {}

  public async reconcile(
    record: TempVoiceRecord,
    channel: VoiceChannel,
    options: TempVoiceProjectionOptions,
  ): Promise<void> {
    await this.reconcileChannelSettings(record, channel);
    await this.reconcilePermissions(record, channel);

    if (options.controlPanelEnabled) {
      await this.reconcilePanel(
        record,
        channel,
        options.forceMessageFetch ?? false,
      );
    } else {
      await this.disableControlPanel(record, channel);
    }

    await this.reconcileOwnershipMessages(
      record,
      channel,
      options.forceMessageFetch ?? false,
    );
  }

  private async reconcileChannelSettings(
    record: TempVoiceRecord,
    channel: VoiceChannel,
  ): Promise<void> {
    const desiredRegion =
      record.customRegion && record.customRegion !== "auto"
        ? record.customRegion
        : null;
    const patch: {
      name?: string;
      userLimit?: number;
      bitrate?: number;
      rtcRegion?: string | null;
      reason?: string;
    } = {};

    if (record.customName && channel.name !== record.customName) {
      patch.name = record.customName;
    }
    if (
      record.customUserLimit !== null &&
      channel.userLimit !== record.customUserLimit
    ) {
      patch.userLimit = record.customUserLimit;
    }
    if (
      record.customBitrate !== null &&
      channel.bitrate !== record.customBitrate
    ) {
      patch.bitrate = Math.min(
        record.customBitrate,
        channel.guild.maximumBitrate,
      );
    }
    if (record.customRegion !== null && channel.rtcRegion !== desiredRegion) {
      patch.rtcRegion = desiredRegion;
    }

    if (Object.keys(patch).length > 0) {
      patch.reason = `tempvoice:reconcile:${record.operationId}`;
      await channel.edit(patch);
    }
  }

  private async reconcilePermissions(
    record: TempVoiceRecord,
    channel: VoiceChannel,
  ): Promise<void> {
    const hasCurrentOwner = hasCurrentTempVoiceOwner(record);
    const desiredManagedUsers = new Set([
      ...(hasCurrentOwner ? [record.ownerId] : []),
      ...record.allowedUserIds,
      ...record.deniedUserIds,
      ...record.trustedUserIds,
    ]);

    for (const staleUserId of record.managedUserIds) {
      if (desiredManagedUsers.has(staleUserId)) continue;
      await this.editPermissionsIfChanged(channel, staleUserId, {
        ViewChannel: null,
        Connect: null,
        Speak: null,
        Stream: null,
        UseVAD: null,
      });
    }

    await this.editPermissionsIfChanged(
      channel,
      channel.guild.roles.everyone.id,
      {
        ViewChannel: record.isHidden ? false : true,
        Connect: record.isLocked ? false : true,
      },
    );

    if (hasCurrentOwner) {
      await this.editPermissionsIfChanged(channel, record.ownerId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
        UseVAD: true,
      });
    }

    for (const userId of record.deniedUserIds) {
      if (isCurrentTempVoiceOwner(record, userId)) continue;
      await this.editPermissionsIfChanged(channel, userId, {
        ViewChannel: false,
        Connect: false,
        Speak: null,
        Stream: null,
        UseVAD: null,
      });
    }

    for (const userId of record.allowedUserIds) {
      if (
        isCurrentTempVoiceOwner(record, userId) ||
        record.deniedUserIds.includes(userId)
      )
        continue;
      await this.editPermissionsIfChanged(channel, userId, {
        ViewChannel: true,
        Connect: true,
      });
    }

    for (const userId of record.trustedUserIds) {
      if (
        isCurrentTempVoiceOwner(record, userId) ||
        record.deniedUserIds.includes(userId)
      )
        continue;
      await this.editPermissionsIfChanged(channel, userId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
        UseVAD: true,
      });
    }

    const managedUserIds = [...desiredManagedUsers].sort();
    if (
      JSON.stringify(managedUserIds) !==
      JSON.stringify([...record.managedUserIds].sort())
    ) {
      await this.prisma.tempVoiceChannel.update({
        where: { id: record.id },
        data: { managedUserIds },
      });
    }
  }

  private async editPermissionsIfChanged(
    channel: VoiceChannel,
    targetId: string,
    desired: Partial<
      Record<
        "ViewChannel" | "Connect" | "Speak" | "Stream" | "UseVAD",
        boolean | null
      >
    >,
  ): Promise<void> {
    const overwrite = channel.permissionOverwrites.cache.get(targetId);
    const flags = {
      ViewChannel: PermissionFlagsBits.ViewChannel,
      Connect: PermissionFlagsBits.Connect,
      Speak: PermissionFlagsBits.Speak,
      Stream: PermissionFlagsBits.Stream,
      UseVAD: PermissionFlagsBits.UseVAD,
    } as const;
    const isDifferent = Object.entries(desired).some(([name, value]) => {
      const flag = flags[name as keyof typeof flags];
      const isAllowed = overwrite?.allow.has(flag) ?? false;
      const isDenied = overwrite?.deny.has(flag) ?? false;
      if (value === true) return !isAllowed || isDenied;
      if (value === false) return isAllowed || !isDenied;
      return isAllowed || isDenied;
    });
    if (!isDifferent) return;
    await channel.permissionOverwrites.edit(targetId, desired);
  }

  private async reconcilePanel(
    record: TempVoiceRecord,
    channel: VoiceChannel,
    forceMessageFetch: boolean,
  ): Promise<void> {
    const built = this.buildPanel(record, channel);
    const renderHash = this.hash(built.toJSON());
    const delivery = await this.getDelivery(
      record.id,
      TempVoiceDeliveryKind.CONTROL_PANEL,
      0,
    );

    if (
      delivery?.status === TempVoiceDeliveryStatus.DELIVERED &&
      delivery.renderHash === renderHash &&
      !forceMessageFetch
    ) {
      return;
    }

    const existingMessage = delivery?.messageId
      ? await this.fetchMessage(channel, delivery.messageId, forceMessageFetch)
      : null;

    const message = existingMessage
      ? await existingMessage.edit({
          content: null,
          embeds: [],
          components: [built],
          flags: MessageFlags.IsComponentsV2,
        })
      : await channel.send({
          components: [built],
          flags: MessageFlags.IsComponentsV2,
        });

    await this.prisma.$transaction([
      this.prisma.tempVoiceDelivery.upsert({
        where: {
          aggregateId_kind_epoch: {
            aggregateId: record.id,
            kind: TempVoiceDeliveryKind.CONTROL_PANEL,
            epoch: 0,
          },
        },
        create: {
          aggregateId: record.id,
          kind: TempVoiceDeliveryKind.CONTROL_PANEL,
          epoch: 0,
          destinationId: channel.id,
          messageId: message.id,
          renderHash,
          status: TempVoiceDeliveryStatus.DELIVERED,
        },
        update: {
          destinationId: channel.id,
          messageId: message.id,
          renderHash,
          status: TempVoiceDeliveryStatus.DELIVERED,
          lastError: null,
        },
      }),
      this.prisma.tempVoiceChannel.update({
        where: { id: record.id },
        data: {
          controlPanelChannelId: channel.id,
          controlPanelMessageId: message.id,
        },
      }),
    ]);
  }

  private buildPanel(record: TempVoiceRecord, channel: VoiceChannel) {
    const humanMemberCount = channel.members.filter(
      (member) => !member.user.bot,
    ).size;
    const userLimit = record.customUserLimit ?? channel.userLimit;
    const members =
      userLimit > 0
        ? `${humanMemberCount}/${userLimit}`
        : `${humanMemberCount}`;
    const bitrate = Math.round(
      (record.customBitrate ?? channel.bitrate) / 1000,
    );
    const region = record.customRegion || channel.rtcRegion || "auto";
    const owner = hasCurrentTempVoiceOwner(record)
      ? `<@${record.ownerId}>`
      : "Unclaimed";

    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "settings", channel.id))
        .setEmoji(EMOJI.UI.ACTIONS.SETTINGS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "users", channel.id))
        .setEmoji(EMOJI.USER.ICONS.MULTIPLE_MEMBERS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "ownership", channel.id))
        .setEmoji(EMOJI.USER.ROLES.OWNER)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "refresh", channel.id))
        .setEmoji(EMOJI.UI.NAV.REPLAY)
        .setStyle(ButtonStyle.Secondary),
    );

    return fluentContainer({ color: 0xffffff })
      .h2("Voice Channel Control Panel")
      .separator()
      .kv({
        [`${EMOJI.USER.ROLES.OWNER} Owner`]: owner,
        [`${EMOJI.USER.ICONS.MULTIPLE_MEMBERS} Members`]: `\`${members}\``,
      })
      .separator()
      .text(
        `> ${EMOJI.VOICE.CONTROLS.BITRATE} \`${bitrate}kbps\` • ` +
          `${EMOJI.TIME.LOCATION} \`${region}\`\n` +
          `> ${record.isHidden ? "hidden" : "visible"} • ` +
          `${record.isLocked ? "locked" : "unlocked"}`,
      )
      .divider()
      .footer(`${EMOJI.USER.ICONS.ID_CARD} Channel ID: ${channel.id}`)
      .actions(actions)
      .build();
  }

  private async reconcileOwnershipMessages(
    record: TempVoiceRecord,
    channel: VoiceChannel,
    forceMessageFetch: boolean,
  ): Promise<void> {
    if (
      record.lifecycle === TempVoiceLifecycleState.DELETING ||
      record.lifecycle === TempVoiceLifecycleState.DELETED ||
      record.ownershipStatus === TempVoiceOwnershipState.OWNER_PRESENT
    ) {
      await this.supersedeOwnershipMessages(record);
      return;
    }

    const candidates = channel.members
      .filter(
        (member) =>
          !member.user.bot && !isCurrentTempVoiceOwner(record, member.id),
      )
      .map((member) => member);

    await this.reconcileChannelOwnershipNotice(
      record,
      channel,
      forceMessageFetch,
    );
    await this.reconcileOwnerDm(record, candidates, forceMessageFetch);
  }

  private async reconcileChannelOwnershipNotice(
    record: TempVoiceRecord,
    channel: VoiceChannel,
    forceMessageFetch: boolean,
  ): Promise<void> {
    const isClaimable =
      record.ownershipStatus === TempVoiceOwnershipState.CLAIMABLE;
    const content = isClaimable
      ? `${EMOJI.STATUS.WARNING} <@${record.ownerId}> did not return. This channel can now be claimed by a member inside it.`
      : `${EMOJI.STATUS.WARNING} <@${record.ownerId}>, choose a new owner or return before <t:${Math.floor((record.claimableAt?.getTime() ?? 0) / 1000)}:R>.`;
    const button = new ButtonBuilder()
      .setCustomId(
        encodeCustomId(
          "tv",
          isClaimable ? "claim" : "transfer",
          channel.id,
          String(record.ownershipEpoch),
        ),
      )
      .setLabel(isClaimable ? "Claim channel" : "Choose new owner")
      .setStyle(isClaimable ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(button),
    ];
    const renderHash = this.hash({
      content,
      components: components.map((row) => row.toJSON()),
    });
    const delivery = await this.getOwnershipDelivery(
      record.id,
      TempVoiceDeliveryKind.OWNERSHIP_NOTICE,
    );
    if (
      delivery?.status === TempVoiceDeliveryStatus.DELIVERED &&
      delivery.renderHash === renderHash &&
      !forceMessageFetch
    ) {
      return;
    }

    const existing = delivery?.messageId
      ? await this.fetchMessage(channel, delivery.messageId, forceMessageFetch)
      : null;
    const message = existing
      ? await existing.edit({ content, components })
      : await channel.send({ content, components });

    await this.saveDelivery(
      record.id,
      TempVoiceDeliveryKind.OWNERSHIP_NOTICE,
      TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
      channel.id,
      message.id,
      renderHash,
    );
    await this.supersedeLegacyOwnershipDeliveries(
      record,
      TempVoiceDeliveryKind.OWNERSHIP_NOTICE,
      message.id,
    );
  }

  private async reconcileOwnerDm(
    record: TempVoiceRecord,
    candidates: GuildMember[],
    forceMessageFetch: boolean,
  ): Promise<void> {
    const delivery = await this.getOwnershipDelivery(
      record.id,
      TempVoiceDeliveryKind.OWNER_DM,
    );
    const content = this.ownerDmContent(record, candidates.length);
    const components = this.ownerDmComponents(record, candidates, 0);
    const renderHash = this.hash({
      content,
      components: components.map((row) => row.toJSON()),
    });
    if (
      delivery?.status === TempVoiceDeliveryStatus.FAILED &&
      delivery.renderHash === renderHash &&
      !forceMessageFetch
    ) {
      const retryDelayMs = Math.min(
        300_000,
        30_000 * 2 ** Math.min(delivery.attempts, 4),
      );
      if (delivery.updatedAt.getTime() + retryDelayMs > Date.now()) return;
    }
    if (
      delivery?.status === TempVoiceDeliveryStatus.DELIVERED &&
      delivery.renderHash === renderHash &&
      !forceMessageFetch
    ) {
      return;
    }

    try {
      const owner = await this.client.users.fetch(record.ownerId);
      const dm = await owner.createDM();
      const existing = delivery?.messageId
        ? await this.fetchMessage(dm, delivery.messageId, forceMessageFetch)
        : null;
      const message = existing
        ? await existing.edit({ content, components })
        : await dm.send({ content, components });
      await this.saveDelivery(
        record.id,
        TempVoiceDeliveryKind.OWNER_DM,
        TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
        dm.id,
        message.id,
        renderHash,
      );
      await this.supersedeLegacyOwnershipDeliveries(
        record,
        TempVoiceDeliveryKind.OWNER_DM,
        message.id,
      );
    } catch (error) {
      const classified = classifyDiscordError(error);
      await this.prisma.tempVoiceDelivery.upsert({
        where: {
          aggregateId_kind_epoch: {
            aggregateId: record.id,
            kind: TempVoiceDeliveryKind.OWNER_DM,
            epoch: TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
          },
        },
        create: {
          aggregateId: record.id,
          kind: TempVoiceDeliveryKind.OWNER_DM,
          epoch: TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
          status: TempVoiceDeliveryStatus.FAILED,
          attempts: 1,
          renderHash,
          lastError: classified.message,
        },
        update: {
          status: TempVoiceDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          renderHash,
          lastError: classified.message,
        },
      });
      container.logger.warn(
        `[TempVoiceProjection] Could not deliver owner DM for ${record.id}: ${classified.code}`,
      );
    }
  }

  private ownerDmContent(
    record: TempVoiceRecord,
    candidateCount: number,
  ): string {
    if (record.ownershipStatus === TempVoiceOwnershipState.CLAIMABLE) {
      return `Your temporary voice channel <#${record.channelId}> is now open for claim.`;
    }
    return (
      `You left <#${record.channelId}>. Return or transfer ownership before ` +
      `<t:${Math.floor((record.claimableAt?.getTime() ?? 0) / 1000)}:R>. ` +
      `${candidateCount} eligible member(s) are currently inside.`
    );
  }

  private ownerDmComponents(
    record: TempVoiceRecord,
    candidates: GuildMember[],
    page: number,
  ): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
    if (
      record.ownershipStatus !== TempVoiceOwnershipState.OWNER_GRACE ||
      candidates.length === 0 ||
      !record.channelId
    ) {
      return [];
    }

    const pageCount = Math.max(1, Math.ceil(candidates.length / 25));
    const safePage = Math.min(Math.max(page, 0), pageCount - 1);
    const pageCandidates = candidates.slice(safePage * 25, safePage * 25 + 25);
    const select = new StringSelectMenuBuilder()
      .setCustomId(
        encodeCustomId(
          "tv",
          "grace_transfer_select",
          record.guildId,
          record.channelId,
          String(record.ownershipEpoch),
          String(safePage),
        ),
      )
      .setPlaceholder("Choose the new owner")
      .addOptions(
        pageCandidates.map((member) => ({
          label: member.displayName.slice(0, 100),
          description: member.user.username.slice(0, 100),
          value: member.id,
        })),
      );
    const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    ];

    if (pageCount > 1) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              encodeCustomId(
                "tv",
                "grace_page",
                record.guildId,
                record.channelId,
                String(record.ownershipEpoch),
                String(Math.max(0, safePage - 1)),
              ),
            )
            .setLabel("Previous")
            .setDisabled(safePage === 0)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(
              encodeCustomId(
                "tv",
                "grace_page",
                record.guildId,
                record.channelId,
                String(record.ownershipEpoch),
                String(Math.min(pageCount - 1, safePage + 1)),
              ),
            )
            .setLabel("Next")
            .setDisabled(safePage === pageCount - 1)
            .setStyle(ButtonStyle.Secondary),
        ),
      );
    }
    return rows;
  }

  private async supersedeOwnershipMessages(
    record: TempVoiceRecord,
  ): Promise<void> {
    const deliveries = await this.prisma.tempVoiceDelivery.findMany({
      where: {
        aggregateId: record.id,
        kind: {
          in: [
            TempVoiceDeliveryKind.OWNERSHIP_NOTICE,
            TempVoiceDeliveryKind.OWNER_DM,
          ],
        },
        status: {
          in: [
            TempVoiceDeliveryStatus.DELIVERED,
            TempVoiceDeliveryStatus.FAILED,
          ],
        },
      },
    });

    for (const delivery of deliveries) {
      await this.disableDeliveryMessage(record, delivery).catch(
        (error: unknown) => {
          container.logger.debug(
            `[TempVoiceProjection] Could not disable superseded delivery ${delivery.id}: ${String(error)}`,
          );
        },
      );
    }

    if (deliveries.length > 0) {
      await this.prisma.tempVoiceDelivery.updateMany({
        where: { id: { in: deliveries.map((delivery) => delivery.id) } },
        data: { status: TempVoiceDeliveryStatus.SUPERSEDED },
      });
    }
  }

  private async disableControlPanel(
    record: TempVoiceRecord,
    channel: VoiceChannel,
  ): Promise<void> {
    const delivery = await this.getDelivery(
      record.id,
      TempVoiceDeliveryKind.CONTROL_PANEL,
      0,
    );
    const messageId = delivery?.messageId ?? record.controlPanelMessageId;
    if (messageId) {
      const message = await this.fetchMessage(channel, messageId, true);
      if (message) await message.delete();
    }
    if (!delivery && !record.controlPanelMessageId) return;

    await this.prisma.$transaction([
      this.prisma.tempVoiceDelivery.updateMany({
        where: {
          aggregateId: record.id,
          kind: TempVoiceDeliveryKind.CONTROL_PANEL,
          epoch: 0,
        },
        data: { status: TempVoiceDeliveryStatus.SUPERSEDED },
      }),
      this.prisma.tempVoiceChannel.update({
        where: { id: record.id },
        data: { controlPanelChannelId: null, controlPanelMessageId: null },
      }),
    ]);
  }

  private async disableDeliveryMessage(
    record: TempVoiceRecord,
    delivery: TempVoiceDelivery,
  ): Promise<void> {
    if (!delivery.destinationId || !delivery.messageId) return;
    const destination = await this.client.channels.fetch(
      delivery.destinationId,
    );
    if (!destination || !("messages" in destination)) return;
    let message: Message | null;
    try {
      message = await destination.messages.fetch(delivery.messageId);
    } catch (error) {
      if (!classifyDiscordError(error).isUnknownResource) throw error;
      message = null;
    }
    if (!message) return;
    await message.edit({
      content:
        delivery.kind === TempVoiceDeliveryKind.OWNER_DM
          ? `Ownership for <#${record.channelId}> is currently held by <@${record.ownerId}>.`
          : `${EMOJI.STATUS.SUCCESS} Ownership is currently held by <@${record.ownerId}>.`,
      components: [],
    });
  }

  private async getOwnershipDelivery(
    aggregateId: string,
    kind:
      | typeof TempVoiceDeliveryKind.OWNERSHIP_NOTICE
      | typeof TempVoiceDeliveryKind.OWNER_DM,
  ): Promise<TempVoiceDelivery | null> {
    const current = await this.getDelivery(
      aggregateId,
      kind,
      TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
    );
    if (current) return current;
    return this.prisma.tempVoiceDelivery.findFirst({
      where: { aggregateId, kind },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async supersedeLegacyOwnershipDeliveries(
    record: TempVoiceRecord,
    kind:
      | typeof TempVoiceDeliveryKind.OWNERSHIP_NOTICE
      | typeof TempVoiceDeliveryKind.OWNER_DM,
    currentMessageId: string,
  ): Promise<void> {
    const legacy = await this.prisma.tempVoiceDelivery.findMany({
      where: {
        aggregateId: record.id,
        kind,
        epoch: { not: TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH },
        status: {
          in: [
            TempVoiceDeliveryStatus.DELIVERED,
            TempVoiceDeliveryStatus.FAILED,
          ],
        },
      },
    });
    for (const delivery of legacy) {
      if (delivery.messageId === currentMessageId) continue;
      await this.disableDeliveryMessage(record, delivery).catch(
        (error: unknown) => {
          container.logger.debug(
            `[TempVoiceProjection] Could not supersede legacy delivery ${delivery.id}: ${String(error)}`,
          );
        },
      );
    }
    if (legacy.length > 0) {
      await this.prisma.tempVoiceDelivery.updateMany({
        where: { id: { in: legacy.map((delivery) => delivery.id) } },
        data: { status: TempVoiceDeliveryStatus.SUPERSEDED },
      });
    }
  }

  private getDelivery(
    aggregateId: string,
    kind: TempVoiceDeliveryKind,
    epoch: number,
  ): Promise<TempVoiceDelivery | null> {
    return this.prisma.tempVoiceDelivery.findUnique({
      where: { aggregateId_kind_epoch: { aggregateId, kind, epoch } },
    });
  }

  private async saveDelivery(
    aggregateId: string,
    kind: TempVoiceDeliveryKind,
    epoch: number,
    destinationId: string,
    messageId: string,
    renderHash: string,
  ): Promise<void> {
    await this.prisma.tempVoiceDelivery.upsert({
      where: { aggregateId_kind_epoch: { aggregateId, kind, epoch } },
      create: {
        aggregateId,
        kind,
        epoch,
        destinationId,
        messageId,
        renderHash,
        status: TempVoiceDeliveryStatus.DELIVERED,
      },
      update: {
        destinationId,
        messageId,
        renderHash,
        status: TempVoiceDeliveryStatus.DELIVERED,
        lastError: null,
      },
    });
  }

  private async fetchMessage(
    channel: VoiceChannel | DMChannel,
    messageId: string,
    forceFetch: boolean,
  ): Promise<Message | null> {
    if (!forceFetch) {
      const cached = channel.messages.cache.get(messageId);
      if (cached) return cached;
    }
    try {
      return await channel.messages.fetch(messageId);
    } catch (error) {
      const classified = classifyDiscordError(error);
      if (classified.isUnknownResource) return null;
      throw error;
    }
  }

  private hash(value: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(value))
      .digest("base64url");
  }
}
