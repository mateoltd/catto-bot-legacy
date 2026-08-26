export type TempVoiceCommand =
  | TempVoiceChannelCommand
  | {
      readonly kind: "CREATE_FROM_JOIN";
      readonly guildId: string;
      readonly actorId: string;
      readonly sourceChannelId: string;
    };

export type TempVoiceChannelCommand =
  | TempVoiceSimpleCommand
  | TempVoiceUsersCommand
  | TempVoiceValueCommand
  | {
      readonly kind: "TRANSFER_OWNERSHIP";
      readonly guildId: string;
      readonly channelId: string;
      readonly actorId: string;
      readonly targetUserId: string;
      readonly expectedOwnershipEpoch?: number;
    }
  | {
      readonly kind: "CLAIM_OWNERSHIP";
      readonly guildId: string;
      readonly channelId: string;
      readonly actorId: string;
      readonly expectedOwnershipEpoch?: number;
    };

export type TempVoiceSimpleCommand = {
  readonly kind:
    | "TOGGLE_LOCK"
    | "TOGGLE_HIDE"
    | "RESET_SETTINGS"
    | "RECONCILE_CHANNEL";
  readonly guildId: string;
  readonly channelId: string;
  readonly actorId: string;
};

export type TempVoiceUsersCommand = {
  readonly kind: "PERMIT_USERS" | "DENY_USERS" | "TOGGLE_TRUST" | "KICK_USERS";
  readonly guildId: string;
  readonly channelId: string;
  readonly actorId: string;
  readonly userIds: readonly string[];
};

export type TempVoiceValueCommand =
  | {
      readonly kind: "RENAME_CHANNEL";
      readonly guildId: string;
      readonly channelId: string;
      readonly actorId: string;
      readonly name: string;
    }
  | {
      readonly kind: "SET_USER_LIMIT" | "SET_BITRATE";
      readonly guildId: string;
      readonly channelId: string;
      readonly actorId: string;
      readonly value: number;
    }
  | {
      readonly kind: "SET_REGION";
      readonly guildId: string;
      readonly channelId: string;
      readonly actorId: string;
      readonly region: string;
    };

export type TempVoiceSignal =
  | {
      readonly kind: "VOICE_STATE_OBSERVED";
      readonly guildId: string;
      readonly userId: string;
      readonly oldChannelId: string | null;
      readonly newChannelId: string | null;
      readonly observedAt: number;
    }
  | {
      readonly kind: "CHANNEL_PRESENCE_DIRTY";
      readonly guildId: string;
      readonly channelId: string;
      readonly observedAt: number;
    }
  | {
      readonly kind: "CHANNEL_DELETED";
      readonly guildId: string;
      readonly channelId: string;
      readonly observedAt: number;
    }
  | {
      readonly kind: "CHANNEL_UPDATED";
      readonly guildId: string;
      readonly channelId: string;
      readonly observedName?: string;
      readonly observedAt: number;
    }
  | {
      readonly kind: "RECONCILE_DUE";
      readonly aggregateId: string;
      readonly expectedRevision?: number;
      readonly expectedOwnershipEpoch?: number;
      readonly observedAt: number;
    }
  | {
      readonly kind: "RECONCILE_GUILD";
      readonly guildId: string;
      readonly observedAt: number;
    };

export type TempVoiceTransportMessage =
  | { readonly type: "COMMAND"; readonly command: TempVoiceCommand }
  | { readonly type: "SIGNAL"; readonly signal: TempVoiceSignal }
  | { readonly type: "OUTBOX"; readonly outboxId: string };
