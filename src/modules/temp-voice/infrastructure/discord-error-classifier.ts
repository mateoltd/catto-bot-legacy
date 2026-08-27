import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

export interface ClassifiedDiscordError {
  readonly code: string;
  readonly message: string;
  readonly isUnknownResource: boolean;
  readonly isMissingPermissions: boolean;
  readonly isRateLimited: boolean;
  readonly isPermanentDeliveryFailure: boolean;
  readonly retryable: boolean;
}

// discord.js 14.25 predates this documented Discord JSON error code.
const CANNOT_DM_WITHOUT_MUTUAL_GUILD = 50_278;

export function classifyDiscordError(error: unknown): ClassifiedDiscordError {
  if (error instanceof DiscordAPIError) {
    const code = String(error.code);
    const isUnknownResource =
      error.code === RESTJSONErrorCodes.UnknownChannel ||
      error.code === RESTJSONErrorCodes.UnknownMessage;
    const isMissingPermissions =
      error.code === RESTJSONErrorCodes.MissingPermissions;
    const isRateLimited = error.status === 429;
    const isPermanentDeliveryFailure =
      error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser ||
      error.code === RESTJSONErrorCodes.UnknownUser ||
      error.code === CANNOT_DM_WITHOUT_MUTUAL_GUILD;
    return {
      code,
      message: error.message,
      isUnknownResource,
      isMissingPermissions,
      isRateLimited,
      isPermanentDeliveryFailure,
      retryable: !isUnknownResource && !isPermanentDeliveryFailure,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "DISCORD_UNAVAILABLE",
    message,
    isUnknownResource: false,
    isMissingPermissions: false,
    isRateLimited: false,
    isPermanentDeliveryFailure: false,
    retryable: true,
  };
}
