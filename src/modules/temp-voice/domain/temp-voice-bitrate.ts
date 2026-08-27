const MIN_BITRATE_KBPS = 8;
const MAX_BITRATE_KBPS = 384;
const BITS_PER_KILOBIT = 1_000;
const MIN_BITRATE_BPS = MIN_BITRATE_KBPS * BITS_PER_KILOBIT;
const MAX_BITRATE_BPS = MAX_BITRATE_KBPS * BITS_PER_KILOBIT;

/** Config values are canonical kbps; legacy cache entries used Discord bps. */
export function normalizeConfigBitrateKbps(
  value: number | null,
): number | null {
  if (value === null) return null;
  return value >= MIN_BITRATE_BPS && value <= MAX_BITRATE_BPS
    ? Math.floor(value / BITS_PER_KILOBIT)
    : Math.min(MAX_BITRATE_KBPS, Math.max(MIN_BITRATE_KBPS, value));
}

/** Channel overrides and preferences are canonical Discord bps. */
export function normalizeDiscordBitrateBps(
  value: number | null,
): number | null {
  if (value === null) return null;
  if (value >= MIN_BITRATE_KBPS && value <= MAX_BITRATE_KBPS) {
    return value * BITS_PER_KILOBIT;
  }
  if (
    value >= MIN_BITRATE_BPS * BITS_PER_KILOBIT &&
    value <= MAX_BITRATE_BPS * BITS_PER_KILOBIT
  ) {
    return Math.floor(value / BITS_PER_KILOBIT);
  }
  return Math.min(MAX_BITRATE_BPS, Math.max(MIN_BITRATE_BPS, value));
}
