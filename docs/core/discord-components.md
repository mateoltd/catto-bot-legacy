# Discord Components

> Location: `src/lib/discord/`

Utility library for building Discord UI components with a fluent API.

## Directory Structure

```
src/lib/discord/
├── components/       # Buttons, modals, selects
├── containers/       # FluentContainer builder
├── core/             # CustomId, format, reply utilities
├── design/           # Colors, emojis
├── embeds/           # Embed builders
├── handlers.ts       # Interaction handlers
├── responses.ts      # Response utilities
└── index.ts          # Main exports
```

## FluentContainer

The primary way to build Discord messages with Components V2.

### Basic Usage

```typescript
import { successContainer, errorContainer } from '#lib/discord/containers/index.js';

// Success message
const response = successContainer()
  .h2('User Banned')
  .text(`Successfully banned ${user.tag}`)
  .footer(`Case #${caseNumber}`);

await interaction.reply({ components: [response.build()], flags: MessageFlags.IsComponentsV2 });
```

### Factory Functions

| Function | Color | Use Case |
|----------|-------|----------|
| `container()` | None | Custom color |
| `successContainer()` | Green | Success messages |
| `errorContainer()` | Red | Error messages |
| `warningContainer()` | Yellow | Warnings |
| `infoContainer()` | Blue | Information |
| `primaryContainer()` | Discord Blue | Primary actions |
| `neutralContainer()` | Gray | Neutral messages |

### Text Methods

```typescript
container()
  .text('Plain text')
  .h1('Heading 1')
  .h2('Heading 2')
  .h3('Heading 3')
  .texts('Line 1', 'Line 2', 'Line 3')
  .quote('Quoted text')
  .codeBlock('const x = 1;', 'typescript')
  .footer('Small footer text')
  .footerWithTimestamp('Updated');
```

### Key-Value Pairs

```typescript
container()
  .kv({
    'User': user.tag,
    'ID': user.id,
    'Joined': joinedAt,
  });
// **User:** username#0001
// **ID:** 123456789
// **Joined:** 2024-01-01
```

### Lists

```typescript
container()
  .list(['Item 1', 'Item 2', 'Item 3'], 'My List')
  .numberedList(['First', 'Second', 'Third']);
```

### Sections with Thumbnails

```typescript
// Simple: single text with thumbnail
container()
  .h2('User Profile')
  .withThumbnail(user.avatarURL());

// Combined: multiple texts merged
container()
  .beginSection()
    .h2('Moderation History')
    .text(`User: ${user.tag}`)
    .kv({ Bans: 2, Warns: 8 })
  .withThumbnail(user.avatarURL());
```

### Separators

```typescript
container()
  .text('Section 1')
  .divider()           // Line separator
  .text('Section 2')
  .space()             // Large spacing
  .text('Section 3')
  .separator({ spacing: 'small' });
```

### Media

```typescript
container()
  .image('https://example.com/image.png', 'Description')
  .gallery([
    'https://example.com/1.png',
    { url: 'https://example.com/2.png', description: 'Image 2' }
  ])
  .file('https://example.com/document.pdf');
```

### Buttons

```typescript
// Primary buttons
container()
  .primaryButtons(
    { id: 'confirm', label: 'Confirm', emoji: '✅' },
    { id: 'details', label: 'Details' }
  );

// Danger buttons
container()
  .dangerButtons(
    { id: 'delete', label: 'Delete', emoji: '🗑️' }
  );

// Mixed styles
container()
  .buttons(
    { id: 'save', label: 'Save', style: 'success' },
    { id: 'cancel', label: 'Cancel', style: 'secondary' },
    { id: 'delete', label: 'Delete', style: 'danger', disabled: true }
  );

// Confirm/Cancel row
container()
  .confirmRow('confirm_action', 'cancel_action', {
    confirmLabel: 'Yes, delete',
    cancelLabel: 'No, keep it',
    danger: true
  });

// Link buttons
container()
  .linkButtons(
    { url: 'https://example.com', label: 'Website', emoji: '🔗' }
  );
```

### Conditional Content

```typescript
container()
  .h2('User Info')
  .when(user.bot, (c) => c.text('This user is a bot'))
  .when(hasBio, (c) => c.text(`Bio: ${bio}`));
```

### Building

```typescript
const container = successContainer()
  .h2('Success')
  .text('Operation completed.');

// Get the ContainerBuilder
const builder = container.build();

// Or get JSON
const json = container.toJSON();
```

## Reply Utilities

> Location: `src/lib/discord/core/reply.ts`

### `reply(interaction, container)`

Send a reply with a FluentContainer:

```typescript
import { reply } from '#lib/discord/core/reply.js';

await reply(interaction, successContainer().text('Done!'));
```

### `editReply(interaction, container)`

Edit a deferred reply:

```typescript
import { editReply } from '#lib/discord/core/reply.js';

await interaction.deferReply();
// ... do work
await editReply(interaction, successContainer().text('Completed!'));
```

## Preset Messages

> Location: `src/lib/discord/containers/presets.ts`

```typescript
import { errorMessage, successMessage } from '#lib/discord/containers/index.js';

// Quick error
errorMessage('Error', 'Something went wrong.');

// Quick success
successMessage('Success', 'Operation completed.');
```

## Colors

> Location: `src/lib/discord/design/colors.ts`

```typescript
import { COLORS } from '#lib/discord/design/index.js';

COLORS.SUCCESS  // Green
COLORS.ERROR    // Red
COLORS.WARNING  // Yellow
COLORS.INFO     // Blue
COLORS.PRIMARY  // Discord Blue
COLORS.NEUTRAL  // Gray
```

## Custom IDs

> Location: `src/lib/discord/core/customId.ts`

Utilities for building and parsing component custom IDs:

```typescript
import { buildCustomId, parseCustomId } from '#lib/discord/core/customId.js';

// Build
const id = buildCustomId('mod', 'ban', 'confirm', userId);
// 'mod:ban:confirm:123456789'

// Parse
const parts = parseCustomId(id);
// ['mod', 'ban', 'confirm', '123456789']
```

## Formatting

> Location: `src/lib/discord/core/format.ts`

```typescript
import { formatUser, formatChannel, formatTimestamp } from '#lib/discord/core/format.js';

formatUser(user);       // @username or <@123456789>
formatChannel(channel); // #channel-name or <#123456789>
formatTimestamp(date);  // <t:1704067200:R>
```

## Buttons Builder

> Location: `src/lib/discord/components/buttons.ts`

```typescript
import { createButton, createDangerButton } from '#lib/discord/components/buttons.js';

const button = createButton({
  customId: 'my_button',
  label: 'Click Me',
  style: ButtonStyle.Primary,
  emoji: '👍',
});
```

## Modals Builder

> Location: `src/lib/discord/components/modals.ts`

```typescript
import { createModal, createTextInput } from '#lib/discord/components/modals.js';

const modal = createModal({
  customId: 'my_modal',
  title: 'Enter Details',
  components: [
    createTextInput({
      customId: 'reason',
      label: 'Reason',
      style: TextInputStyle.Paragraph,
      required: true,
    }),
  ],
});

await interaction.showModal(modal);
```

## Select Menus

> Location: `src/lib/discord/components/selects.ts`

```typescript
import { createStringSelect, createUserSelect } from '#lib/discord/components/selects.js';

const select = createStringSelect({
  customId: 'my_select',
  placeholder: 'Choose an option',
  options: [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ],
});
```

## Complete Example

```typescript
import { Command } from '@sapphire/framework';
import { successContainer, errorContainer } from '#lib/discord/containers/index.js';
import { reply, editReply } from '#lib/discord/core/reply.js';
import { Gate } from '#lib/validation/Gate.js';

export class InfoCommand extends Command {
  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const gate = Gate.from(interaction);
    if (!gate) return;

    const user = interaction.options.getUser('user', true);
    const member = await gate.resolveMember(user.id);

    if (!member) {
      return reply(interaction, errorContainer()
        .h2('User Not Found')
        .text('That user is not in this server.')
      );
    }

    await interaction.deferReply();

    const response = successContainer()
      .beginSection()
        .h2(`${member.user.tag}`)
        .kv({
          'ID': member.id,
          'Joined': member.joinedAt?.toLocaleDateString(),
          'Roles': member.roles.cache.size - 1,
        })
      .withThumbnail(member.displayAvatarURL())
      .divider()
      .footer('User Information');

    await editReply(interaction, response);
  }
}
```

## Related

- [Creating Commands](../commands/creating-commands.md) - Using components in commands
- [Logging](logging.md) - Creating log embeds
