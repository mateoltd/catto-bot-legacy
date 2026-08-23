/**
 * Button Builders
 *
 * Fluent API for building Discord buttons and action rows.
 * Provides presets for common button patterns.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';

// Types

/**
 * Button configuration
 * Note: At least one of label or emoji must be provided
 */
export interface ButtonConfig {
  customId: string;
  label?: string;
  style: ButtonStyle;
  emoji?: string;
  disabled?: boolean;
}

/**
 * Link button configuration (no customId, requires URL)
 */
export interface LinkButtonConfig {
  url: string;
  label: string;
  emoji?: string;
  disabled?: boolean;
}

/**
 * Simplified button config for common cases
 * Note: At least one of label or emoji must be provided
 */
export interface SimpleButtonConfig {
  customId: string;
  label?: string;
  emoji?: string;
  disabled?: boolean;
}

// Button Factories

/**
 * Create a button from config
 */
export function button(config: ButtonConfig): ButtonBuilder {
  const btn = new ButtonBuilder().setCustomId(config.customId).setStyle(config.style);

  if (config.label) {
    btn.setLabel(config.label);
  }

  if (config.emoji) {
    btn.setEmoji(config.emoji);
  }

  if (config.disabled) {
    btn.setDisabled(true);
  }

  return btn;
}

/**
 * Create a primary button
 */
export function primaryButton(config: SimpleButtonConfig): ButtonBuilder {
  return button({
    ...config,
    style: ButtonStyle.Primary,
  });
}

/**
 * Create a secondary button
 */
export function secondaryButton(config: SimpleButtonConfig): ButtonBuilder {
  return button({
    ...config,
    style: ButtonStyle.Secondary,
  });
}

/**
 * Create a success button
 */
export function successButton(config: SimpleButtonConfig): ButtonBuilder {
  return button({
    ...config,
    style: ButtonStyle.Success,
  });
}

/**
 * Create a danger button
 */
export function dangerButton(config: SimpleButtonConfig): ButtonBuilder {
  return button({
    ...config,
    style: ButtonStyle.Danger,
  });
}

/**
 * Create a link button
 */
export function linkButton(url: string, label: string, emoji?: string): ButtonBuilder {
  const btn = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);

  if (emoji) {
    btn.setEmoji(emoji);
  }

  return btn;
}

// Action Row Builders

/**
 * Create a button row from button configs
 */
export function buttonRow(buttons: ButtonConfig[]): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const config of buttons) {
    row.addComponents(button(config));
  }
  return row;
}

/**
 * Create a button row from button builders
 */
export function row(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

// Preset Buttons

/**
 * Create a confirm button
 */
export function confirmButton(customId: string, label: string = 'Confirm'): ButtonBuilder {
  return successButton({
    customId,
    label,
    emoji: EMOJI.STATUS.SUCCESS,
  });
}

/**
 * Create a cancel button
 */
export function cancelButton(customId: string, label: string = 'Cancel'): ButtonBuilder {
  return secondaryButton({
    customId,
    label,
    emoji: EMOJI.STATUS.ERROR,
  });
}

/**
 * Create a delete button
 */
export function deleteButton(customId: string, label: string = 'Delete'): ButtonBuilder {
  return dangerButton({
    customId,
    label,
    emoji: EMOJI.STATUS.ERROR,
  });
}

/**
 * Create a refresh button
 */
export function refreshButton(customId: string, label: string = 'Refresh'): ButtonBuilder {
  return secondaryButton({
    customId,
    label,
    emoji: EMOJI.UI.NAV.REPLAY,
  });
}

/**
 * Create a back button
 */
export function backButton(customId: string, label: string = 'Back'): ButtonBuilder {
  return secondaryButton({
    customId,
    label,
    emoji: EMOJI.UI.NAV.LEFT,
  });
}

/**
 * Create a next button
 */
export function nextButton(customId: string, label: string = 'Next'): ButtonBuilder {
  return secondaryButton({
    customId,
    label,
    emoji: EMOJI.UI.NAV.RIGHT,
  });
}

/**
 * Create a done button
 */
export function doneButton(customId: string, label: string = 'Done'): ButtonBuilder {
  return successButton({
    customId,
    label,
    emoji: EMOJI.STATUS.SUCCESS,
  });
}

/**
 * Create an edit button
 */
export function editButton(customId: string, label: string = 'Edit'): ButtonBuilder {
  return primaryButton({
    customId,
    label,
    emoji: EMOJI.UI.ACTIONS.EDIT,
  });
}

/**
 * Create a view button
 */
export function viewButton(customId: string, label: string = 'View'): ButtonBuilder {
  return secondaryButton({
    customId,
    label,
    emoji: EMOJI.UI.ACTIONS.MORE,
  });
}

// Preset Action Rows

/**
 * Create a confirmation row with confirm and cancel buttons
 */
export function confirmationRow(
  confirmId: string,
  cancelId: string,
  options?: {
    confirmLabel?: string;
    cancelLabel?: string;
    confirmStyle?: ButtonStyle;
    dangerConfirm?: boolean;
  }
): ActionRowBuilder<ButtonBuilder> {
  const confirmBtn = options?.dangerConfirm
    ? dangerButton({
        customId: confirmId,
        label: options?.confirmLabel ?? 'Confirm',
        emoji: EMOJI.STATUS.SUCCESS,
      })
    : successButton({
        customId: confirmId,
        label: options?.confirmLabel ?? 'Confirm',
        emoji: EMOJI.STATUS.SUCCESS,
      });

  const cancelBtn = cancelButton(cancelId, options?.cancelLabel);

  return row(confirmBtn, cancelBtn);
}

/**
 * Create a pagination row
 */
export function paginationRow(
  baseCustomId: string,
  currentPage: number,
  totalPages: number,
  options?: {
    showFirst?: boolean;
    showLast?: boolean;
    showPageInfo?: boolean;
    /** Force all buttons to be disabled (e.g., after a collector times out). */
    disabled?: boolean;
  }
): ActionRowBuilder<ButtonBuilder> {
  const allDisabled = options?.disabled === true;
  const buttons: ButtonBuilder[] = [];

  // First page button
  if (options?.showFirst !== false) {
    buttons.push(
      secondaryButton({
        customId: `${baseCustomId}:first`,
        emoji: EMOJI.UI.NAV.LEFT,
        disabled: allDisabled || currentPage <= 1,
      })
    );
  }

  // Previous button
  buttons.push(
    secondaryButton({
      customId: `${baseCustomId}:prev`,
      emoji: EMOJI.UI.NAV.LEFT,
      disabled: allDisabled || currentPage <= 1,
    })
  );

  // Page info (disabled button showing current position)
  if (options?.showPageInfo !== false) {
    buttons.push(
      secondaryButton({
        customId: `${baseCustomId}:info`,
        label: `${currentPage}/${totalPages}`,
        disabled: true,
      })
    );
  }

  // Next button
  buttons.push(
    secondaryButton({
      customId: `${baseCustomId}:next`,
      emoji: EMOJI.UI.NAV.RIGHT,
      disabled: allDisabled || currentPage >= totalPages,
    })
  );

  // Last page button
  if (options?.showLast !== false) {
    buttons.push(
      secondaryButton({
        customId: `${baseCustomId}:last`,
        emoji: EMOJI.UI.NAV.RIGHT,
        disabled: allDisabled || currentPage >= totalPages,
      })
    );
  }

  return row(...buttons);
}

/**
 * Create a navigation row with back and done buttons
 */
export function navigationRow(
  backId: string,
  doneId: string,
  options?: {
    backLabel?: string;
    doneLabel?: string;
    showBack?: boolean;
  }
): ActionRowBuilder<ButtonBuilder> {
  const buttons: ButtonBuilder[] = [];

  if (options?.showBack !== false) {
    buttons.push(backButton(backId, options?.backLabel));
  }

  buttons.push(doneButton(doneId, options?.doneLabel));

  return row(...buttons);
}
