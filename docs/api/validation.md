# Validation API

> Location: `src/lib/validation/zod.ts`

Zod schemas and validation utilities for user input.

## Schemas

### `snowflakeSchema`

Validates Discord Snowflake IDs (17-19 digit strings).

```typescript
import { snowflakeSchema } from '#lib/validation/zod.js';

const result = snowflakeSchema.safeParse('123456789012345678');
// { success: true, data: '123456789012345678' }

const invalid = snowflakeSchema.safeParse('not-a-snowflake');
// { success: false, error: ZodError }
```

**Pattern:** `/^\d{17,19}$/`

---

### `durationStringSchema`

Validates duration strings (e.g., `10m`, `1h`, `2d`, `1w`).

```typescript
import { durationStringSchema } from '#lib/validation/zod.js';

durationStringSchema.parse('10m');  // '10m'
durationStringSchema.parse('1h30m'); // '1h30m'
durationStringSchema.parse('2d');   // '2d'
durationStringSchema.parse('1w');   // '1w'
```

**Pattern:** `/^(\d+[smhdw])+$/`

| Unit | Meaning |
|------|---------|
| `s` | Seconds |
| `m` | Minutes |
| `h` | Hours |
| `d` | Days |
| `w` | Weeks |

---

### `reasonSchema`

Optional reason string with max length.

```typescript
import { reasonSchema } from '#lib/validation/zod.js';

reasonSchema.parse('Spamming in chat'); // 'Spamming in chat'
reasonSchema.parse(undefined);          // undefined
reasonSchema.parse('a'.repeat(600));    // throws - too long
```

**Constraints:** Optional, max 512 characters

---

### `reasonRequiredSchema`

Required reason string with min/max length.

```typescript
import { reasonRequiredSchema } from '#lib/validation/zod.js';

reasonRequiredSchema.parse('Spamming');   // 'Spamming'
reasonRequiredSchema.parse('');           // throws - too short
reasonRequiredSchema.parse(undefined);    // throws - required
```

**Constraints:** Required, 1-512 characters

---

## Helper Functions

### `safeParse<T>(schema, data)`

Safely parse with a discriminated result (no exceptions).

```typescript
import { safeParse, snowflakeSchema } from '#lib/validation/zod.js';

const result = safeParse(snowflakeSchema, userInput);

if (result.success) {
  // result.data is the validated value
  console.log(result.data);
} else {
  // result.error is a user-friendly message
  return reply(`Invalid input: ${result.error}`);
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `ZodType` | Zod schema to validate against |
| `data` | `unknown` | Data to validate |

**Returns:**
- `{ success: true; data: T }` on success
- `{ success: false; error: string }` on failure

---

### `parseOrThrow<T>(schema, data)`

Parse and throw `ValidationError` on failure.

```typescript
import { parseOrThrow, durationStringSchema } from '#lib/validation/zod.js';

try {
  const duration = parseOrThrow(durationStringSchema, userInput);
  // Use duration
} catch (error) {
  if (isValidationError(error)) {
    return reply(error.message);
  }
  throw error;
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `ZodType` | Zod schema to validate against |
| `data` | `unknown` | Data to validate |

**Returns:** `T` - Validated data

**Throws:** `ValidationError` on failure

---

## ValidationError

Custom error class for user-facing validation errors.

```typescript
import { ValidationError, isValidationError } from '#lib/validation/zod.js';

class ValidationError extends Error {
  readonly isValidationError = true;
  name = 'ValidationError';
}
```

### `isValidationError(error)`

Type guard for ValidationError.

```typescript
import { isValidationError } from '#lib/validation/zod.js';

try {
  // ...
} catch (error) {
  if (isValidationError(error)) {
    // Handle validation error
    return reply(error.message);
  }
  // Re-throw other errors
  throw error;
}
```

---

## Custom Schemas

Create custom schemas for your commands:

```typescript
import { z } from 'zod';

// Custom schema for ban options
const banOptionsSchema = z.object({
  userId: snowflakeSchema,
  reason: reasonSchema,
  duration: durationStringSchema.optional(),
  deleteMessages: z.boolean().default(false),
});

type BanOptions = z.infer<typeof banOptionsSchema>;

// In command
const options = safeParse(banOptionsSchema, {
  userId: interaction.options.getString('user'),
  reason: interaction.options.getString('reason'),
  duration: interaction.options.getString('duration'),
  deleteMessages: interaction.options.getBoolean('delete_messages'),
});
```

---

## Usage in Commands

Typical validation pattern in a command:

```typescript
import { Command } from '@sapphire/framework';
import { safeParse, snowflakeSchema, reasonSchema } from '#lib/validation/zod.js';

export class BanCommand extends Command {
  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason');

    // Validate user ID
    const userResult = safeParse(snowflakeSchema, userId);
    if (!userResult.success) {
      return interaction.reply({
        content: `Invalid user ID: ${userResult.error}`,
        ephemeral: true,
      });
    }

    // Validate reason (if provided)
    const reasonResult = safeParse(reasonSchema, reason);
    if (!reasonResult.success) {
      return interaction.reply({
        content: `Invalid reason: ${reasonResult.error}`,
        ephemeral: true,
      });
    }

    // Use validated data
    await this.executeBan(userResult.data, reasonResult.data);
  }
}
```

---

## Related

- [Gate System](../core/gate-system.md) - Validation with permissions
- [Commands](../commands/creating-commands.md) - Command input handling
