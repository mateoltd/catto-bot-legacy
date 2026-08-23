/**
 * DTO Validation Utility
 * Validates request data using class-validator
 */

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    constraints: string[];
  }>;
}

/**
 * Validates a plain object against a DTO class
 *
 * @param dtoClass The DTO class to validate against
 * @param plain The plain object to validate
 * @returns Validation result with typed data or error details
 */
export async function validateDto<T extends object>(
  dtoClass: new () => T,
  plain: unknown
): Promise<ValidationResult<T>> {
  // Guard against null/undefined input
  if (plain === null || plain === undefined) {
    return {
      success: false,
      errors: [{ field: '_body', constraints: ['Request body is required'] }],
    };
  }

  // Transform plain object to class instance
  const dtoInstance = plainToInstance(dtoClass, plain, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  // Validate
  const validationErrors: ValidationError[] = await validate(dtoInstance, {
    whitelist: true,
    forbidNonWhitelisted: false,
    validationError: { target: false },
  });

  if (validationErrors.length > 0) {
    const errors = validationErrors.map((error) => ({
      field: error.property,
      constraints: Object.values(error.constraints || {}),
    }));

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: dtoInstance,
  };
}
