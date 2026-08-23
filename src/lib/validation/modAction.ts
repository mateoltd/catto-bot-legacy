import { ModAction } from '@prisma/client';

/**
 * Parse a string into a Prisma ModAction enum value.
 * Returns undefined if the action is not a valid ModAction.
 */
export function parseModAction(action: string): ModAction | undefined {
  if (Object.values(ModAction).includes(action as ModAction)) {
    return action as ModAction;
  }
  return undefined;
}
