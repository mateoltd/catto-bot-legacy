import type { Message } from 'discord.js';
import type { Command } from '@sapphire/framework';

export interface CommandOptions extends Command.Options {
  description: string;
  detailedDescription?: string;
  usage?: string;
  examples?: string[];
}

export interface MessageCommandSuccessPayload {
  message: Message;
  command: Command;
  parameters: string;
}

export interface MessageCommandDeniedPayload {
  message: Message;
  command: Command;
  reason: string;
}

export interface MessageCommandErrorPayload {
  message: Message;
  command: Command;
  error: Error;
}
