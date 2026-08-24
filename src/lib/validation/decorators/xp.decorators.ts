import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Requires at least one threshold when the request selects a table-based level curve.
 * Formula configurations legitimately persist an empty tableThresholds array.
 */
export function HasThresholdsForTableCurve(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasThresholdsForTableCurve',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!Array.isArray(value)) return true;
          const curveType = (args.object as { levelCurveType?: unknown }).levelCurveType;
          return curveType !== 'TABLE' || value.length > 0;
        },
        defaultMessage() {
          return 'tableThresholds must contain at least one value for TABLE curves';
        },
      },
    });
  };
}
