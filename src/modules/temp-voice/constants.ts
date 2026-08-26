/**
 * Constants and default values for the Temp Voice module
 */

/**
 * Default configuration values for temp voice module
 */
export const DEFAULT_TEMP_VOICE_CONFIG = {
  enabled: true,
  joinToCreateChannels: [] as string[],
  categoryId: null,
  fallbackCategoryId: null,
  defaultNameTemplate: "{username}'s Channel",
  defaultUserLimit: 0, // 0 = unlimited
  defaultBitrate: 64, // Stored in kbps; API and Discord use bits per second
  defaultRegion: null, // null = auto
  defaultLocked: false,
  defaultHidden: false,
  deleteDelaySeconds: 300,
  cooldownSeconds: 10,
  maxChannelsPerUser: 3,
  controlPanelEnabled: true,
  logChannelId: null,
  adminRoleIds: [] as string[],
  allowCustomization: true,

  // Name Moderation (optional, disabled by default)
  moderationEnabled: false,
  moderationAction: "AUTO_RENAME" as const,
  strictMode: false,
  allowListEnabled: false,
  customPatterns: [] as string[],
  allowedKeywords: [] as string[],
} as const;

/** Stable delivery slot for ownership notices; component freshness is fenced separately. */
export const TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH = 0;

/**
 * Validation limits for configuration values
 */
export const TEMP_VOICE_LIMITS = {
  /** Minimum deletion delay in seconds */
  MIN_DELETE_DELAY: 0,
  /** Maximum deletion delay in seconds (5 minutes) */
  MAX_DELETE_DELAY: 300,

  /** Minimum cooldown in seconds */
  MIN_COOLDOWN: 0,
  /** Maximum cooldown in seconds (10 minutes) */
  MAX_COOLDOWN: 600,

  /** Minimum channels per user */
  MIN_CHANNELS_PER_USER: 1,
  /** Maximum channels per user */
  MAX_CHANNELS_PER_USER: 10,

  /** Minimum user limit for voice channels */
  MIN_USER_LIMIT: 0,
  /** Maximum user limit for voice channels */
  MAX_USER_LIMIT: 99,

  /** Minimum bitrate in kbps */
  MIN_BITRATE: 8,
  /** Maximum bitrate in kbps (Level 3 boost) */
  MAX_BITRATE: 384,

  /** Maximum length of channel name template */
  MAX_TEMPLATE_LENGTH: 100,

  /** Discord's maximum channels per category */
  MAX_CHANNELS_PER_CATEGORY: 50,

  /** Maximum recommended active temp channels per guild */
  MAX_RECOMMENDED_CHANNELS: 100,
} as const;

/**
 * Available bitrate options based on guild boost level
 */
export const BITRATE_OPTIONS = {
  /** Base bitrates available to all guilds */
  BASE: [8, 16, 32, 64, 96],
  /** Additional bitrates for Level 1+ boost */
  BOOST_1: [128],
  /** Additional bitrates for Level 2+ boost */
  BOOST_2: [256],
  /** Additional bitrates for Level 3 boost */
  BOOST_3: [384],
} as const;

/**
 * Available voice regions
 */
export const VOICE_REGIONS = [
  "auto",
  "brazil",
  "europe",
  "hongkong",
  "india",
  "japan",
  "rotterdam",
  "russia",
  "singapore",
  "southafrica",
  "sydney",
  "us-central",
  "us-east",
  "us-south",
  "us-west",
] as const;

/**
 * Template variable names that can be used in channel naming
 */
export const TEMPLATE_VARIABLES = {
  /** User's username */
  USERNAME: "{username}",
  /** User's server display name */
  DISPLAYNAME: "{displayname}",
  /** User's discriminator (if any) */
  DISCRIMINATOR: "{discriminator}",
  /** Full user tag (username#discriminator or just username) */
  TAG: "{tag}",
  /** Sequential number */
  NUMBER: "{n}",
  /** Sequential number (alias for {n}) */
  COUNT: "{count}",
} as const;

/**
 * Event types for temp voice logging
 */
export enum TempVoiceEventType {
  CREATED = "CREATED",
  DELETED = "DELETED",
  RENAMED = "RENAMED",
  LOCKED = "LOCKED",
  UNLOCKED = "UNLOCKED",
  HIDDEN = "HIDDEN",
  SHOWN = "SHOWN",
  LIMIT_CHANGED = "LIMIT_CHANGED",
  BITRATE_CHANGED = "BITRATE_CHANGED",
  REGION_CHANGED = "REGION_CHANGED",
  OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED",
  USER_PERMITTED = "USER_PERMITTED",
  USER_DENIED = "USER_DENIED",
  USER_KICKED = "USER_KICKED",
  SETTINGS_RESET = "SETTINGS_RESET",
  ERROR = "ERROR",
}

/**
 * API error codes
 */
export enum TempVoiceApiError {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  CHANNEL_NOT_FOUND = "CHANNEL_NOT_FOUND",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  INVALID_CHANNEL = "INVALID_CHANNEL",
  CHANNEL_ALREADY_ADDED = "CHANNEL_ALREADY_ADDED",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_TEMP_CHANNEL = "NOT_TEMP_CHANNEL",
  NOT_OWNER = "NOT_OWNER",
  USER_NOT_IN_CHANNEL = "USER_NOT_IN_CHANNEL",
  COOLDOWN_ACTIVE = "COOLDOWN_ACTIVE",
  USER_LIMIT_REACHED = "USER_LIMIT_REACHED",
  CATEGORY_FULL = "CATEGORY_FULL",
  MISSING_PERMISSIONS = "MISSING_PERMISSIONS",
}

/**
 * Rate limits for API endpoints (requests per minute)
 */
export const API_RATE_LIMITS = {
  /** Configuration endpoints */
  CONFIG: 10,
  /** Channel management endpoints */
  CHANNELS: 30,
  /** Statistics endpoints */
  STATS: 60,
  /** Validation endpoints */
  VALIDATION: 20,
} as const;

/**
 * Redis key prefixes for temp voice module
 */
export const REDIS_KEYS = {
  /** User cooldown: tempvoice:cooldown:{userId}:{guildId} */
  COOLDOWN: "tempvoice:cooldown",
  /** Config cache: tempvoice:config:{guildId} */
  CONFIG_CACHE: "tempvoice:config",
  /** Join-to-create notice deduplication: tempvoice:join-notice:{guildId}:{userId}:{code} */
  JOIN_NOTICE: "tempvoice:join-notice",
  /** Presence generation used to coalesce aggregate reconciliation */
  PRESENCE_DIRTY: "tempvoice:presence-dirty",
} as const;

/**
 * Cache TTLs in seconds
 */
export const CACHE_TTL = {
  /** Config cache duration (5 minutes) */
  CONFIG: 300,
} as const;
