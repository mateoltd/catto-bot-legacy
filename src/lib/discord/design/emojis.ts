let useCustomEmojis = true;

export const setUseCustomEmojis = (value: boolean) => {
  useCustomEmojis = value;
};

type EmojiDef = { custom: string; fallback: string };

/**
 * The Recursive Mapper
 * It iterates through T
 * If a property extends EmojiDef, it becomes string
 * Otherwise, it recurses
 */
type TransformedEmojis<T> = {
  [K in keyof T]: T[K] extends EmojiDef
    ? string
    : T[K] extends object
      ? TransformedEmojis<T[K]>
      : never;
};

// Type Guard:
// This allows TS to narrow the type inside the loop without casting
function isEmojiDef(value: unknown): value is EmojiDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'custom' in value &&
    'fallback' in value &&
    typeof (value as EmojiDef).custom === 'string' &&
    typeof (value as EmojiDef).fallback === 'string'
  );
}

// Grouped by semantic meaning (Domain -> Category -> Specific)
const RAW_EMOJIS = {
  STATUS: {
    SUCCESS: { custom: '<:green_check:1463366102917714134>', fallback: '\u2705' },
    ERROR: { custom: '<:red_cross:1462784451099754598>', fallback: '\u274C' },
    WARNING: { custom: '<:yellow_warning:1463366097838407868>', fallback: '\u26A0\uFE0F' },
    INFO: { custom: '<:discord_info:1463368489317437612>', fallback: '\u2139\uFE0F' },
    LOADING: { custom: '<:replay:1462789298293313679>', fallback: '\u23F3' },
  },

  MODERATION: {
    ICONS: {
      SHIELD_BLUE: { custom: '<:mod_shield:1462816389260775547>', fallback: '\uD83D\uDEE1\uFE0F' },
      SHIELD_RED: { custom: '<:red_shield:1463744820395900939>', fallback: '\uD83D\uDEE1\uFE0F' },
      CENSOR_ASTERISK: {
        custom: '<:moderation:1463375710092791932>',
        fallback: '\uD83C\uDFF7\uFE0F',
      },
    },
    ACTIONS: {
      REPORT: { custom: '<:report_flag:1463366118667190337>', fallback: '\uD83D\uDEA9' },
      SLOWMODE: { custom: '<:slowmode:1463366107804205240>', fallback: '\u23F1\uFE0F' },
      KICK: { custom: '<:server_leave:1462784544490000445>', fallback: '\uD83D\uDC62' }, // todo: find better one
    },
    STATE: {
      SUSPICIOUS: {
        custom: '<:suspected_actvity:1462785167285551167>',
        fallback: '\uD83D\uDD75\uFE0F',
      },
    },
  },

  VOICE: {
    ICONS: {
      GENERIC: { custom: '<:channel_voice:1462784525766627338>', fallback: '\uD83D\uDD0A' },
      STAGE: { custom: '<:channel_stage:1462784552379617351>', fallback: '\uD83C\uDFAD' },
      ACTIVITIES: { custom: '<:activities:1462784554795270298>', fallback: '\uD83C\uDFAE' },
    },
    CONTROLS: {
      TOGGLE_MIC: { custom: '<:voice_toggle:1462785392452305100>', fallback: '\uD83C\uDFA4' },
      PAUSE: { custom: '<:sound_pause_white:1462796413376139429>', fallback: '\u23F8\uFE0F' },
      BITRATE: { custom: '<:bitrate:1464762636926455808>', fallback: '\uD83D\uDD0A' },
    },
    STATE: {
      MUTED: { custom: '<:muted:1462784532481577042>', fallback: '\uD83D\uDD07' },
      UNMUTED: { custom: '<:un_muted:1462784536076353683>', fallback: '\uD83D\uDD0A' },
      DEAFENED: { custom: '<:defean:1462784534419603590>', fallback: '\uD83D\uDD08' },
      UNDEAFENED: { custom: '<:un_defean:1462784538072584327>', fallback: '\uD83D\uDD0A' },

      SERVER_MUTED: { custom: '<:server_muted:1462784529713594596>', fallback: '\uD83D\uDD07' },
      SERVER_DEAFENED: { custom: '<:server_defean:1462784531038863523>', fallback: '\uD83D\uDD08' },

      VIDEO: { custom: '<:channel_voice_video:1462784548021600360>', fallback: '\uD83D\uDCF9' },
      SCREENSHARE: {
        custom: '<:server_screenshare:1462784522671095894>',
        fallback: '\uD83D\uDCF9',
      },
      ACTIVE: { custom: '<:channel_voice_active:1464762456856461323>', fallback: '\uD83D\uDD0A' },
    },
  },

  CHANNELS: {
    TYPES: {
      TEXT: { custom: '<:text:1462785165985321103>', fallback: '\uD83D\uDCDD' },
      FOLDER: { custom: '<:server_folder:1463375728958504981>', fallback: '\uD83D\uDCC4' },
      NSFW: { custom: '<:channel_voice_nsfw:1462784524675977269>', fallback: '\uD83D\uDD1E' },
    },
    STATE: {
      TEXT_CHECKED_WHITE: {
        custom: '<:text_channel_with_check_white:1463669927121649765>',
        fallback: '\uD83D\uDCDD\uFE0F',
      },
      TEXT_LIMITED_WHITE: {
        custom: '<:text_limiter:1463532129081229454>',
        fallback: '\uD83D\uDD08',
      },
      VOICE_CHECKED_WHITE: {
        custom: '<:voice_channel_with_check_white:1463669963251519694>',
        fallback: '\uD83D\uDD0A\uFE0F',
      },
      VOICE_LIMITED_WHITE: {
        custom: '<:voice_limiter:1463532166586564700>',
        fallback: '\uD83D\uDD08',
      },
      LOCKED: { custom: '<:channel_locked:1464762947573125252>', fallback: '\uD83D\uDD12' },
      UNLOCKED: { custom: '<:channel_unlocked:1470760381017489579>', fallback: '\uD83D\uDD13' },
    },
    ACTIONS: {
      CREATE: { custom: '<:create_channel:1463745157873537098>', fallback: '\uD83D\uDCCE' },
    },
  },

  USER: {
    ICONS: {
      MEMBER: { custom: '<:member:1462785171416813731>', fallback: '\uD83D\uDC64' },
      MULTIPLE_MEMBERS: { custom: '<:members:1464762244029087855>', fallback: '\uD83D\uDC65' },
      ID_CARD: { custom: '<:copy_id:1462785169881825353>', fallback: '\uD83D\uDCCB' },
    },
    ACTIONS: {
      INVITE: { custom: '<:invite:1463743915965288532>', fallback: '\u2795' },
      CONNECT: { custom: '<:connect_to_user:1462785395233390707>', fallback: '\uD83D\uDD17' },
      DISCONNECT: { custom: '<:disconnect_user:1462785393895280660>', fallback: '\uD83D\uDEAA' },
    },
    ROLES: {
      OWNER: { custom: '<:server_owner:1462784527670837372>', fallback: '\uD83D\uDC51' },
    },
  },

  UI: {
    NAV: {
      LEFT: { custom: '<:arrow_left_g:1463366126929973455>', fallback: '\u2B05\uFE0F' },
      RIGHT: { custom: '<:arrow_right_g:1463366121204875275>', fallback: '\u27A1\uFE0F' },
      DROPDOWN: { custom: '<:chevron_dropdown:1463366233121620167>', fallback: '\u25BC\uFE0F' },
      LEAVE_SERVER: { custom: '<:server_leave:1462784544490000445>', fallback: '\uD83D\uDEAA' },
      REPLAY: { custom: '<:replay:1462789298293313679>', fallback: '\uD83D\uDD04' },
    },
    ACTIONS: {
      ADD_GREEN: { custom: '<:add_green:1469782014218600488>', fallback: '\u2795' },
      ADD_WHITE: { custom: '<:add_white:1463534575299858588>', fallback: '\u2795' },
      EDIT: { custom: '<:edit:1463366117631197298>', fallback: '\u270F\uFE0F' },
      DELETE: { custom: '<:red_trash:1463744840021049442>', fallback: '\uD83D\uDDD1' },
      SETTINGS: { custom: '<:utilities:1463366116033298536>', fallback: '\u2699\uFE0F' },
      MORE: { custom: '<:more_options:1463368507617050833>', fallback: '\u22EF' },
    },
    INDICATORS: {
      BELL: { custom: '<:notification_bell:1463366109213233358>', fallback: '\uD83D\uDD14' },
      READ: { custom: '<:read_check:1463366119825084501>', fallback: '\u2705' },
      VISIBILITY: { custom: '<:visibility:1464763305754230825>', fallback: '\uD83D\uDC41' },
      HIDDEN: {
        custom: '<:visibility2:1470638578290917426>',
        fallback: '\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8\uFE0F',
      },
    },
  },

  TIME: {
    CLOCK: { custom: '<:time_day:1462786086358093834>', fallback: '\u23F0' },
    EXPIRED: { custom: '<:time_day_expired:1462784541088415867>', fallback: '\u23F1\uFE0F' },
    TIMEOUT: { custom: '<:time_out:1463366100610842806>', fallback: '\u23F1\uFE0F' },
    LOCATION: { custom: '<:event_location:1463368464235499651>', fallback: '\uD83C\uDF0D' },
  },

  REWARDS: {
    MEDALS: {
      GOLD: { custom: '\uD83E\uDD47', fallback: '\uD83E\uDD47' },
      SILVER: { custom: '\uD83E\uDD48', fallback: '\uD83E\uDD48' },
      BRONZE: { custom: '\uD83E\uDD49', fallback: '\uD83E\uDD49' },
    },
    TROPHY: { custom: '\uD83C\uDFC6', fallback: '\uD83C\uDFC6' },
    GIFT: { custom: '\uD83C\uDF81', fallback: '\uD83C\uDF81' },
    CROWN: { custom: '\uD83D\uDC51', fallback: '\uD83D\uDC51' },
  },

  PROGRESS: {
    CHART: { custom: '\uD83D\uDCCA', fallback: '\uD83D\uDCCA' },
    ARROW_UP: { custom: '\uD83D\uDCC8', fallback: '\uD83D\uDCC8' },
    ARROW_DOWN: { custom: '\uD83D\uDCC9', fallback: '\uD83D\uDCC9' },
  },

  XP: {
    LEVEL_UP: { custom: '\uD83C\uDF89', fallback: '\uD83C\uDF89' },
    GAIN: { custom: '\u2728', fallback: '\u2728' },
    BAR: {
      FILLED: { custom: '\u2588', fallback: '\u2588' },
      EMPTY: { custom: '\u2591', fallback: '\u2591' },
    },
    REPUTATION: {
      VOUCH_TYPES: {
        HELPFUL: { custom: '🤝', fallback: '🤝' },
        FRIENDLY: { custom: '😊', fallback: '😊' },
        SKILLED: { custom: '⭐', fallback: '⭐' },
        RELIABLE: { custom: '✅', fallback: '✅' },
        DEFAULT: { custom: '👍', fallback: '👍' },
      },
      // other emoji are exported in REWARDS
      PLATINUM: { custom: '\uD83D\uDC8E', fallback: '\uD83D\uDC8E' },
      DIAMOND: { custom: '\uD83D\uDCA0', fallback: '\uD83D\uDCA0' },
    },
  },

  MISC: {
    INBOX: { custom: '\uD83D\uDCE5', fallback: '\uD83D\uDCE5' },
    OUTBOX: { custom: '\uD83D\uDCE4', fallback: '\uD83D\uDCE4' },
    CALENDAR: { custom: '\uD83D\uDCC5', fallback: '\uD83D\uDCC5' },
  },
} as const;

function createEmojiProxy<T extends object>(source: T): TransformedEmojis<T> {
  // We use Partial here because we build the object iteratively
  const result: Partial<TransformedEmojis<T>> = {};

  // explicitly type 'keys' to help TS iterate safely
  const keys = Object.keys(source) as Array<keyof T>;

  for (const key of keys) {
    const value = source[key];

    if (isEmojiDef(value)) {
      // It's an EmojiDef, so we define the getter
      // we use Object.defineProperty on 'result' directly
      Object.defineProperty(result, key, {
        get: () => (useCustomEmojis ? value.custom : value.fallback),
        enumerable: true,
        configurable: false,
      });
    } else if (typeof value === 'object' && value !== null) {
      // It's a nested object (T[key] extends object)
      // we recurse, then we must cast 'value' to 'object' because T[key] could theoretically be anything
      // BUT our runtime check confirms it is an object
      // the return type of recursion matches the expected property type
      // i know: i'm sick
      result[key] = createEmojiProxy(value as object) as TransformedEmojis<T>[keyof T];
    }
  }

  // we filled every key, so Partial<T> becomes T
  return result as TransformedEmojis<T>;
}

export const EMOJI = createEmojiProxy(RAW_EMOJIS);
