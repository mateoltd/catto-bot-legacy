/**
 * Custom validators for Discord-specific types
 */

import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Validates Discord Snowflake ID format (17-19 digits)
 *
 * @example
 * class MyDto {
 *   @IsDiscordId()
 *   channelId: string;
 * }
 */
export function IsDiscordId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDiscordId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && /^\d{17,19}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Discord ID (17-19 digit snowflake)`;
        },
      },
    });
  };
}

/**
 * Validates an array of Discord IDs
 *
 * @example
 * class MyDto {
 *   @IsDiscordIdArray()
 *   roleIds: string[];
 * }
 */
export function IsDiscordIdArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDiscordIdArray',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) return false;
          return value.every((id) => typeof id === 'string' && /^\d{17,19}$/.test(id));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an array of valid Discord IDs`;
        },
      },
    });
  };
}

/**
 * Validates Discord webhook URL
 *
 * @example
 * class MyDto {
 *   @IsDiscordWebhook()
 *   webhookUrl: string;
 * }
 */
export function IsDiscordWebhook(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDiscordWebhook',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return /^https:\/\/discord\.com\/api\/webhooks\/\d{17,19}\/.+$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Discord webhook URL`;
        },
      },
    });
  };
}
