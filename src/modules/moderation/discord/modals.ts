import { ModalBuilder, TextInputStyle } from 'discord.js';
import { modal, type TextInputConfig } from '#lib/discord/components/modals.js';

export function reasonModal(
  customId: string,
  actionName: string,
  options?: {
    targetId?: string;
    required?: boolean;
    placeholder?: string;
    defaultReason?: string;
    maxLength?: number;
  }
): ModalBuilder {
  const fullCustomId = options?.targetId ? `${customId}:${options.targetId}` : customId;

  return modal({
    customId: fullCustomId,
    title: `${actionName} - Reason`,
    inputs: [
      {
        customId: 'reason',
        label: 'Reason',
        style: TextInputStyle.Paragraph,
        placeholder: options?.placeholder ?? 'Enter a reason for this action...',
        value: options?.defaultReason,
        required: options?.required ?? false,
        maxLength: options?.maxLength ?? 1024,
      },
    ],
  });
}

export function durationModal(
  customId: string,
  actionName: string,
  options?: {
    targetId?: string;
    includeReason?: boolean;
    reasonRequired?: boolean;
    durationPlaceholder?: string;
    durationDefault?: string;
  }
): ModalBuilder {
  const fullCustomId = options?.targetId ? `${customId}:${options.targetId}` : customId;

  const inputs: TextInputConfig[] = [
    {
      customId: 'duration',
      label: 'Duration',
      style: TextInputStyle.Short,
      placeholder: options?.durationPlaceholder ?? 'e.g., 1h, 30m, 1d, 7d',
      value: options?.durationDefault,
      required: true,
      maxLength: 20,
    },
  ];

  if (options?.includeReason !== false) {
    inputs.push({
      customId: 'reason',
      label: 'Reason',
      style: TextInputStyle.Paragraph,
      placeholder: 'Enter a reason for this action...',
      required: options?.reasonRequired ?? false,
      maxLength: 1024,
    });
  }

  return modal({
    customId: fullCustomId,
    title: `${actionName}`,
    inputs,
  });
}

export function noteModal(
  customId: string,
  options?: {
    targetId?: string;
    includeTags?: boolean;
    tagsPlaceholder?: string;
    notePlaceholder?: string;
    maxNoteLength?: number;
  }
): ModalBuilder {
  const fullCustomId = options?.targetId ? `${customId}:${options.targetId}` : customId;

  const inputs: TextInputConfig[] = [
    {
      customId: 'note',
      label: 'Note',
      style: TextInputStyle.Paragraph,
      placeholder: options?.notePlaceholder ?? 'Enter your note...',
      required: true,
      maxLength: options?.maxNoteLength ?? 2000,
    },
  ];

  if (options?.includeTags) {
    inputs.push({
      customId: 'tags',
      label: 'Tags (optional)',
      style: TextInputStyle.Short,
      placeholder: options?.tagsPlaceholder ?? 'e.g., warning, suspicious, context',
      required: false,
      maxLength: 100,
    });
  }

  return modal({
    customId: fullCustomId,
    title: 'Add Note',
    inputs,
  });
}

export function banModal(
  customId: string,
  options?: {
    targetId?: string;
    includeDeleteDays?: boolean;
    reasonRequired?: boolean;
  }
): ModalBuilder {
  const fullCustomId = options?.targetId ? `${customId}:${options.targetId}` : customId;

  const inputs: TextInputConfig[] = [
    {
      customId: 'reason',
      label: 'Reason',
      style: TextInputStyle.Paragraph,
      placeholder: 'Enter a reason for this ban...',
      required: options?.reasonRequired ?? false,
      maxLength: 1024,
    },
  ];

  if (options?.includeDeleteDays !== false) {
    inputs.push({
      customId: 'delete_days',
      label: 'Delete Messages (days, 0-7)',
      style: TextInputStyle.Short,
      placeholder: '0',
      value: '0',
      required: false,
      maxLength: 1,
    });
  }

  return modal({
    customId: fullCustomId,
    title: 'Ban User',
    inputs,
  });
}

export function tempbanModal(
  customId: string,
  options?: {
    targetId?: string;
    reasonRequired?: boolean;
  }
): ModalBuilder {
  const fullCustomId = options?.targetId ? `${customId}:${options.targetId}` : customId;

  return modal({
    customId: fullCustomId,
    title: 'Temporary Ban',
    inputs: [
      {
        customId: 'duration',
        label: 'Duration',
        style: TextInputStyle.Short,
        placeholder: 'e.g., 1d, 7d, 30d',
        required: true,
        maxLength: 20,
      },
      {
        customId: 'reason',
        label: 'Reason',
        style: TextInputStyle.Paragraph,
        placeholder: 'Enter a reason for this ban...',
        required: options?.reasonRequired ?? false,
        maxLength: 1024,
      },
      {
        customId: 'delete_days',
        label: 'Delete Messages (days, 0-7)',
        style: TextInputStyle.Short,
        placeholder: '0',
        value: '0',
        required: false,
        maxLength: 1,
      },
    ],
  });
}

export function timeoutModal(
  customId: string,
  options?: {
    targetId?: string;
    reasonRequired?: boolean;
  }
): ModalBuilder {
  return durationModal(customId, 'Timeout', {
    targetId: options?.targetId,
    includeReason: true,
    reasonRequired: options?.reasonRequired,
    durationPlaceholder: 'e.g., 10m, 1h, 1d (max 28d)',
  });
}

export function warnModal(
  customId: string,
  options?: {
    targetId?: string;
    reasonRequired?: boolean;
  }
): ModalBuilder {
  return reasonModal(customId, 'Warning', {
    targetId: options?.targetId,
    required: options?.reasonRequired ?? true,
    placeholder: 'Enter a reason for this warning...',
  });
}

export function kickModal(
  customId: string,
  options?: {
    targetId?: string;
    reasonRequired?: boolean;
  }
): ModalBuilder {
  return reasonModal(customId, 'Kick', {
    targetId: options?.targetId,
    required: options?.reasonRequired ?? false,
    placeholder: 'Enter a reason for this kick...',
  });
}
