/**
 * FluentContainer - Composable container builder for Components V2
 */

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
  type RGBTuple,
} from 'discord.js';
import { COLORS, EMOJI, SPACING } from '../design/index.js';

export type AccentColor = number | RGBTuple;

export type ContainerComponent =
  | TextDisplayBuilder
  | SeparatorBuilder
  | SectionBuilder
  | MediaGalleryBuilder
  | FileBuilder
  | ActionRowBuilder<MessageActionRowComponentBuilder>;

export interface ContainerOptions {
  color?: AccentColor;
  spoiler?: boolean;
}

export interface FluentButtonConfig {
  id: string;
  label: string;
  emoji?: string;
  disabled?: boolean;
}

export interface FluentLinkButtonConfig {
  url: string;
  label: string;
  emoji?: string;
}

/**
 * Fluent API for building Discord Components V2 containers
 */
export class FluentContainer {
  private builder: ContainerBuilder;
  private lastTextContent: string | null = null;
  private accumulatedText: string[] | null = null;

  constructor(options: ContainerOptions = {}) {
    this.builder = new ContainerBuilder();
    if (options.color) this.builder.setAccentColor(options.color);
    if (options.spoiler) this.builder.setSpoiler(true);
  }

  /**
   * Whether we're currently accumulating text for a combined section
   */
  private get isAccumulating(): boolean {
    return this.accumulatedText !== null;
  }

  // --------------------------------------------------------------------------
  // Container Settings
  // --------------------------------------------------------------------------

  accent(color: AccentColor): this {
    this.builder.setAccentColor(color);
    return this;
  }

  spoiler(isSpoiler = true): this {
    this.builder.setSpoiler(isSpoiler);
    return this;
  }

  // --------------------------------------------------------------------------
  // Text Display
  // --------------------------------------------------------------------------

  text(content: string): this {
    if (this.isAccumulating && this.accumulatedText) {
      this.accumulatedText.push(content);
    } else {
      this.builder.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      this.lastTextContent = content;
    }
    return this;
  }

  texts(...contents: string[]): this {
    for (const content of contents) this.text(content);
    return this;
  }

  h1(content: string): this {
    return this.text(`# ${content}`);
  }

  h2(content: string): this {
    return this.text(`## ${content}`);
  }

  h3(content: string): this {
    return this.text(`### ${content}`);
  }

  kv(pairs: Record<string, string | number | boolean | undefined>): this {
    const content = Object.entries(pairs)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join('\n');
    return this.text(content);
  }

  list(items: string[], title?: string): this {
    const list = items.map((item) => `- ${item}`).join('\n');
    return this.text(title ? `**${title}**\n${list}` : list);
  }

  numberedList(items: string[], title?: string): this {
    const list = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    return this.text(title ? `**${title}**\n${list}` : list);
  }

  codeBlock(code: string, language?: string): this {
    return this.text(`\`\`\`${language ?? ''}\n${code}\n\`\`\``);
  }

  quote(content: string): this {
    const quoted = content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return this.text(quoted);
  }

  footer(text: string): this {
    return this.text(`-# ${text}`);
  }

  footerWithTimestamp(prefix?: string, date?: Date): this {
    const unix = Math.floor((date ?? new Date()).getTime() / 1000);
    const ts = `<t:${unix}:R>`;
    return this.footer(prefix ? `${prefix} · ${ts}` : ts);
  }

  /**
   * Starts accumulating text content for a combined section.
   * All text methods (text, h1, h2, kv, etc.) called after this will be combined
   * into a single text block until `withThumbnail()` or `endSection()` is called.
   *
   * @example
   * container()
   *   .beginSection()
   *     .h2('Moderation History')
   *     .text(`User: ${user.tag}`)
   *     .kv({ Bans: 2, Warns: 8 })
   *   .withThumbnail(user.avatarURL())
   *   .divider()
   *   .text('More content outside the section')
   */
  beginSection(): this {
    if (this.isAccumulating) {
      throw new Error('Already in a section. Call withThumbnail() or endSection() first.');
    }
    this.accumulatedText = [];
    return this;
  }

  /**
   * Ends the current section and commits accumulated text as a plain text display.
   * Use this if you started a section with beginSection() but don't want a thumbnail.
   */
  endSection(): this {
    if (!this.isAccumulating || !this.accumulatedText) {
      throw new Error('Not in a section. Call beginSection() first.');
    }

    const content = this.accumulatedText.join('\n');
    this.accumulatedText = null;

    if (content) {
      this.builder.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      this.lastTextContent = content;
    }

    return this;
  }

  /**
   * Converts text content into a section with a thumbnail accessory.
   *
   * If called after `beginSection()`, combines all accumulated text into one section.
   * If called after a single text method, converts just that text into a section.
   *
   * The thumbnail will appear on the right side of the text content, matching Discord's
   * standard section-with-thumbnail layout (similar to how embed thumbnails work).
   *
   * @param url - The URL of the thumbnail image
   *
   * @example
   * // Simple: single text with thumbnail
   * container()
   *   .h2('User Profile').withThumbnail(user.avatarURL())
   *
   * @example
   * // Combined: multiple texts merged into one section with thumbnail
   * container()
   *   .beginSection()
   *     .h2('Moderation History')
   *     .text(`User: ${user.tag}`)
   *     .kv({ Bans: 2, Warns: 8 })
   *   .withThumbnail(user.avatarURL())
   */
  withThumbnail(url: string): this {
    let content: string;

    if (this.isAccumulating && this.accumulatedText) {
      // Combine all accumulated text
      content = this.accumulatedText.join('\n');
      this.accumulatedText = null;
    } else if (this.lastTextContent) {
      // Use the last single text component
      content = this.lastTextContent;
      // Remove the last component (which was a TextDisplayBuilder)
      this.builder.components.pop();
    } else {
      throw new Error(
        'withThumbnail must be called after beginSection() or a text method (text, h1, h2, h3, etc.)'
      );
    }

    // Create a section with the content and a thumbnail accessory
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(url));

    this.builder.addSectionComponents(section);
    this.lastTextContent = null;
    return this;
  }

  // --------------------------------------------------------------------------
  // Separators
  // --------------------------------------------------------------------------

  separator(options: { divider?: boolean; spacing?: 'small' | 'large' } = {}): this {
    const spacing = options.spacing === 'large' ? SPACING.LARGE : SPACING.SMALL;
    this.builder.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(spacing).setDivider(options.divider ?? false)
    );
    return this;
  }

  divider(): this {
    return this.separator({ divider: true });
  }

  space(): this {
    return this.separator({ spacing: 'large' });
  }

  // --------------------------------------------------------------------------
  // Sections
  // --------------------------------------------------------------------------

  section(content: string, options: { thumbnail?: string; button?: ButtonBuilder } = {}): this {
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );

    if (options.thumbnail) {
      section.setThumbnailAccessory(new ThumbnailBuilder().setURL(options.thumbnail));
    } else if (options.button) {
      section.setButtonAccessory(options.button);
    }

    this.builder.addSectionComponents(section);
    return this;
  }

  sectionWithThumbnail(content: string, thumbnailUrl: string): this {
    return this.section(content, { thumbnail: thumbnailUrl });
  }

  sectionWithButton(content: string, button: ButtonBuilder): this {
    return this.section(content, { button });
  }

  // --------------------------------------------------------------------------
  // Media
  // --------------------------------------------------------------------------

  gallery(items: (string | { url: string; description?: string })[]): this {
    const gallery = new MediaGalleryBuilder();
    for (const item of items) {
      const galleryItem = new MediaGalleryItemBuilder();
      if (typeof item === 'string') {
        galleryItem.setURL(item);
      } else {
        galleryItem.setURL(item.url);
        if (item.description) galleryItem.setDescription(item.description);
      }
      gallery.addItems(galleryItem);
    }
    this.builder.addMediaGalleryComponents(gallery);
    return this;
  }

  image(url: string, description?: string): this {
    return this.gallery([{ url, description }]);
  }

  file(url: string): this {
    this.builder.addFileComponents(new FileBuilder().setURL(url));
    return this;
  }

  // --------------------------------------------------------------------------
  // Action Rows (existing components)
  // --------------------------------------------------------------------------

  actions(...rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): this {
    this.builder.addActionRowComponents(...rows);
    return this;
  }

  rows(...rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): this {
    return this.actions(...rows);
  }

  // --------------------------------------------------------------------------
  // Fluent Button Helpers
  // --------------------------------------------------------------------------

  buttons(
    ...configs: Array<
      FluentButtonConfig & { style?: 'primary' | 'secondary' | 'success' | 'danger' }
    >
  ): this {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const config of configs) {
      const style = this.resolveButtonStyle(config.style ?? 'secondary');
      const button = new ButtonBuilder()
        .setCustomId(config.id)
        .setLabel(config.label)
        .setStyle(style);

      if (config.emoji) button.setEmoji(config.emoji);
      if (config.disabled) button.setDisabled(true);

      row.addComponents(button);
    }

    this.builder.addActionRowComponents(row);
    return this;
  }

  primaryButtons(...configs: FluentButtonConfig[]): this {
    return this.buttons(...configs.map((c) => ({ ...c, style: 'primary' as const })));
  }

  dangerButtons(...configs: FluentButtonConfig[]): this {
    return this.buttons(...configs.map((c) => ({ ...c, style: 'danger' as const })));
  }

  confirmRow(
    confirmId: string,
    cancelId: string,
    options?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }
  ): this {
    const confirmStyle = options?.danger ? ButtonStyle.Danger : ButtonStyle.Success;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel(options?.confirmLabel ?? 'Confirm')
        .setStyle(confirmStyle)
        .setEmoji(EMOJI.STATUS.SUCCESS),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel(options?.cancelLabel ?? 'Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    this.builder.addActionRowComponents(row);
    return this;
  }

  linkButtons(...configs: FluentLinkButtonConfig[]): this {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const config of configs) {
      const button = new ButtonBuilder()
        .setLabel(config.label)
        .setStyle(ButtonStyle.Link)
        .setURL(config.url);
      if (config.emoji) button.setEmoji(config.emoji);
      row.addComponents(button);
    }
    this.builder.addActionRowComponents(row);
    return this;
  }

  private resolveButtonStyle(style: 'primary' | 'secondary' | 'success' | 'danger'): ButtonStyle {
    switch (style) {
      case 'primary':
        return ButtonStyle.Primary;
      case 'success':
        return ButtonStyle.Success;
      case 'danger':
        return ButtonStyle.Danger;
      default:
        return ButtonStyle.Secondary;
    }
  }

  // --------------------------------------------------------------------------
  // Conditional & Composition
  // --------------------------------------------------------------------------

  when(condition: boolean, fn: (container: this) => this): this {
    if (condition) return fn(this);
    return this;
  }

  pipe(fn: (container: this) => this): this {
    return fn(this);
  }

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------

  unwrap(): ContainerBuilder {
    return this.builder;
  }

  build(): ContainerBuilder {
    return this.builder;
  }

  toJSON(): unknown {
    return this.builder.toJSON();
  }
}

// Factory Functions

export function container(options: ContainerOptions = {}): FluentContainer {
  return new FluentContainer(options);
}

export function successContainer(): FluentContainer {
  return container({ color: COLORS.SUCCESS });
}

export function errorContainer(): FluentContainer {
  return container({ color: COLORS.ERROR });
}

export function warningContainer(): FluentContainer {
  return container({ color: COLORS.WARNING });
}

export function infoContainer(): FluentContainer {
  return container({ color: COLORS.INFO });
}

export function primaryContainer(): FluentContainer {
  return container({ color: COLORS.PRIMARY });
}

export function neutralContainer(): FluentContainer {
  return container({ color: COLORS.NEUTRAL });
}
