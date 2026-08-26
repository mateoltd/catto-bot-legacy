import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

export interface ClassifiedDiscordError {
  readonly code: string;
  readonly message: string;
  readonly isUnknownResource: boolean;
  readonly isMissingPermissions: boolean;
  readonly isRateLimited: boolean;
  readonly retryable: boolean;
}

export function classifyDiscordError(error: unknown): ClassifiedDiscordError {
  if (error instanceof DiscordAPIError) {
    const code = String(error.code);
    const isUnknownResource =
      error.code === RESTJSONErrorCodes.UnknownChannel ||
      error.code === RESTJSONErrorCodes.UnknownMessage;
    const isMissingPermissions =
      error.code === RESTJSONErrorCodes.MissingPermissions;
    const isRateLimited = error.status === 429;
    return {
      code,
      message: error.message,
      isUnknownResource,
      isMissingPermissions,
      isRateLimited,
      retryable: !isUnknownResource,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "DISCORD_UNAVAILABLE",
    message,
    isUnknownResource: false,
    isMissingPermissions: false,
    isRateLimited: false,
    retryable: true,
  };
}
