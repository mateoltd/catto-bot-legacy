/**
 * Modal Builders
 *
 * Fluent API for building Discord modals with text inputs.
 * Provides presets for common modal patterns.
 */

import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  type ModalActionRowComponentBuilder,
} from 'discord.js';

// Types

/**
 * Text input configuration
 */
export interface TextInputConfig {
  customId: string;
  label: string;
  style?: TextInputStyle;
  placeholder?: string;
  value?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

/**
 * Modal configuration
 */
export interface ModalConfig {
  customId: string;
  title: string;
  inputs: TextInputConfig[];
}

// Text Input Builders

/**
 * Create a text input from config
 */
export function textInput(config: TextInputConfig): TextInputBuilder {
  const input = new TextInputBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(config.style ?? TextInputStyle.Short);

  if (config.placeholder) {
    input.setPlaceholder(config.placeholder);
  }

  if (config.value) {
    input.setValue(config.value);
  }

  if (config.minLength !== undefined) {
    input.setMinLength(config.minLength);
  }

  if (config.maxLength !== undefined) {
    input.setMaxLength(config.maxLength);
  }

  if (config.required !== undefined) {
    input.setRequired(config.required);
  }

  return input;
}

/**
 * Create a short text input (single line)
 */
export function shortInput(
  customId: string,
  label: string,
  options?: {
    placeholder?: string;
    value?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  }
): TextInputBuilder {
  return textInput({
    customId,
    label,
    style: TextInputStyle.Short,
    ...options,
  });
}

/**
 * Create a paragraph text input (multiline)
 */
export function paragraphInput(
  customId: string,
  label: string,
  options?: {
    placeholder?: string;
    value?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  }
): TextInputBuilder {
  return textInput({
    customId,
    label,
    style: TextInputStyle.Paragraph,
    ...options,
  });
}

/**
 * Wrap a text input in an action row
 */
export function inputRow(
  input: TextInputBuilder
): ActionRowBuilder<ModalActionRowComponentBuilder> {
  return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
}

// Modal Builders

/**
 * Create a modal from config
 */
export function modal(config: ModalConfig): ModalBuilder {
  const m = new ModalBuilder().setCustomId(config.customId).setTitle(config.title);

  for (const inputConfig of config.inputs) {
    const input = textInput(inputConfig);
    const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
    m.addComponents(row);
  }

  return m;
}

/**
 * Create a modal with a single short input
 */
export function singleInputModal(
  customId: string,
  title: string,
  inputConfig: Omit<TextInputConfig, 'customId'> & { customId?: string }
): ModalBuilder {
  return modal({
    customId,
    title,
    inputs: [
      {
        customId: inputConfig.customId ?? 'input',
        ...inputConfig,
      },
    ],
  });
}

/**
 * Create a modal with a single paragraph input
 */
export function paragraphModal(
  customId: string,
  title: string,
  inputConfig: Omit<TextInputConfig, 'customId' | 'style'> & { customId?: string }
): ModalBuilder {
  return modal({
    customId,
    title,
    inputs: [
      {
        customId: inputConfig.customId ?? 'input',
        style: TextInputStyle.Paragraph,
        ...inputConfig,
      },
    ],
  });
}

/**
 * Create a custom form modal
 */
export function formModal(
  customId: string,
  title: string,
  fields: Array<{
    id: string;
    label: string;
    type?: 'short' | 'paragraph';
    placeholder?: string;
    value?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  }>
): ModalBuilder {
  return modal({
    customId,
    title,
    inputs: fields.map((field) => ({
      customId: field.id,
      label: field.label,
      style: field.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short,
      placeholder: field.placeholder,
      value: field.value,
      required: field.required,
      minLength: field.minLength,
      maxLength: field.maxLength,
    })),
  });
}
