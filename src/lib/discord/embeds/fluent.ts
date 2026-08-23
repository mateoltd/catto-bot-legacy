/**
 * FluentEmbed - Composable embed builder
 */

import { EmbedBuilder, type User, type APIEmbedField, type ColorResolvable } from 'discord.js';
import { container } from '@sapphire/framework';
import { COLORS } from '../design/index.js';

export type EmbedTransform = (e: FluentEmbed) => FluentEmbed;

export class FluentEmbed {
  private builder: EmbedBuilder;

  constructor(color?: ColorResolvable) {
    this.builder = new EmbedBuilder();
    if (color) this.builder.setColor(color);
  }

  color(color: ColorResolvable): this {
    this.builder.setColor(color);
    return this;
  }

  title(title: string, emoji?: string): this {
    if (!title?.trim()) return this;
    const fullTitle = emoji ? `${emoji} ${title}` : title;
    this.builder.setTitle(fullTitle);
    return this;
  }

  description(text: string): this {
    if (!text?.trim()) return this;
    this.builder.setDescription(text);
    return this;
  }

  url(url: string): this {
    this.builder.setURL(url);
    return this;
  }

  author(nameOrUser: string | User, options?: { iconURL?: string; url?: string }): this {
    if (typeof nameOrUser === 'string') {
      this.builder.setAuthor({ name: nameOrUser, iconURL: options?.iconURL, url: options?.url });
    } else {
      this.builder.setAuthor({
        name: nameOrUser.tag,
        iconURL: nameOrUser.displayAvatarURL(),
        url: options?.url,
      });
    }
    return this;
  }

  footer(text: string, iconURL?: string): this {
    if (!text?.trim()) return this;
    this.builder.setFooter({ text, iconURL });
    return this;
  }

  timestamp(date?: Date | number): this {
    this.builder.setTimestamp(date);
    return this;
  }

  thumbnail(urlOrUser: string | User): this {
    const url = typeof urlOrUser === 'string' ? urlOrUser : urlOrUser.displayAvatarURL();
    this.builder.setThumbnail(url);
    return this;
  }

  image(url: string): this {
    this.builder.setImage(url);
    return this;
  }

  field(name: string, value: string, inline = false): this {
    if (!name?.trim() || !value?.trim()) return this;
    this.builder.addFields({ name, value, inline });
    return this;
  }

  fields(fields: APIEmbedField[]): this {
    const validFields = fields.filter((f) => f.name?.trim() && f.value?.trim());
    if (validFields.length > 0) this.builder.addFields(validFields);
    return this;
  }

  inlineField(name: string, value: string): this {
    return this.field(name, value, true);
  }

  blankField(inline = false): this {
    return this.field('\u200b', '\u200b', inline);
  }

  kvFields(pairs: Record<string, string | number | boolean | undefined>, inline = true): this {
    const fields = Object.entries(pairs)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([name, value]) => ({ name, value: String(value), inline }));
    return this.fields(fields);
  }

  list(items: string[], title?: string): this {
    const list = items.map((item) => `• ${item}`).join('\n');
    if (title) return this.field(title, list);
    return this.description(list);
  }

  when(condition: boolean, fn: (e: this) => this): this {
    if (condition) return fn(this);
    return this;
  }

  pipe(fn: (e: this) => this): this {
    return fn(this);
  }

  hasContent(): boolean {
    const data = this.builder.data;
    return !!(
      data.title?.trim() ||
      data.description?.trim() ||
      (data.fields && data.fields.length > 0) ||
      data.author?.name?.trim() ||
      data.footer?.text?.trim() ||
      data.image?.url ||
      data.thumbnail?.url
    );
  }

  unwrap(): EmbedBuilder {
    return this.builder;
  }

  build(): EmbedBuilder {
    if (!this.hasContent()) {
      container.logger.warn('[FluentEmbed] Building embed with no visible content');
    }
    return this.builder;
  }

  toJSON(): unknown {
    return this.builder.toJSON();
  }
}

// Factory functions
export function fluentEmbed(color?: ColorResolvable): FluentEmbed {
  return new FluentEmbed(color);
}

export function fluentSuccess(): FluentEmbed {
  return fluentEmbed(COLORS.SUCCESS);
}

export function fluentError(): FluentEmbed {
  return fluentEmbed(COLORS.ERROR);
}

export function fluentWarning(): FluentEmbed {
  return fluentEmbed(COLORS.WARNING);
}

export function fluentInfo(): FluentEmbed {
  return fluentEmbed(COLORS.INFO);
}

export function fluentNeutral(): FluentEmbed {
  return fluentEmbed(COLORS.NEUTRAL);
}

// Composition utilities
export function pipeEmbed(initial: FluentEmbed, ...transforms: EmbedTransform[]): FluentEmbed {
  return transforms.reduce((e, fn) => fn(e), initial);
}

export function composeEmbed(...transforms: EmbedTransform[]): EmbedTransform {
  return (e: FluentEmbed) => transforms.reduce((acc, fn) => fn(acc), e);
}

export function whenEmbed(condition: boolean, transform: EmbedTransform): EmbedTransform {
  return (e: FluentEmbed) => (condition ? transform(e) : e);
}

export function withUser(user: User): EmbedTransform {
  return (e: FluentEmbed) => e.author(user).thumbnail(user);
}

export function withTimestampFooter(footerText: string): EmbedTransform {
  return (e: FluentEmbed) => e.footer(footerText).timestamp();
}
