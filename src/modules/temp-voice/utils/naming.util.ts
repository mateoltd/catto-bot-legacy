/**
 * Utility for handling channel name template variables
 */

import type { GuildMember } from 'discord.js';
import { TempVoiceNamingScheme } from '@prisma/client';
import { TEMPLATE_VARIABLES } from '../constants.js';

/**
 * Template replacement context
 */
export interface TemplateContext {
  username: string;
  displayname: string;
  discriminator?: string;
  tag: string;
  n: number;
}

/**
 * Replace template variables in a channel name template
 */
export function replaceTemplateVariables(template: string, context: TemplateContext): string {
  let result = template;

  // Replace {username}
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.USERNAME.replace(/[{}]/g, '\\$&'), 'g'),
    context.username
  );

  // Replace {displayname}
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.DISPLAYNAME.replace(/[{}]/g, '\\$&'), 'g'),
    context.displayname
  );

  // Replace {discriminator}
  if (context.discriminator) {
    result = result.replace(
      new RegExp(TEMPLATE_VARIABLES.DISCRIMINATOR.replace(/[{}]/g, '\\$&'), 'g'),
      context.discriminator
    );
  }

  // Replace {tag}
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.TAG.replace(/[{}]/g, '\\$&'), 'g'),
    context.tag
  );

  // Replace {n} and {count}
  const seqStr = context.n.toString();
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.NUMBER.replace(/[{}]/g, '\\$&'), 'g'),
    seqStr
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.COUNT.replace(/[{}]/g, '\\$&'), 'g'),
    seqStr
  );

  return result;
}

/**
 * Generate a channel name from a template and guild member
 */
export function generateChannelName(
  template: string,
  member: GuildMember,
  sequenceNumber: number,
  namingScheme: TempVoiceNamingScheme
): string {
  // Determine which name to use based on naming scheme
  const username =
    namingScheme === TempVoiceNamingScheme.USERNAME ? member.user.username : member.displayName;

  const context: TemplateContext = {
    username,
    displayname: member.displayName,
    discriminator: member.user.discriminator !== '0' ? member.user.discriminator : undefined,
    tag: member.user.tag,
    n: sequenceNumber,
  };

  let name = replaceTemplateVariables(template, context);

  // Truncate to Discord's 100 character limit
  if (name.length > 100) {
    name = name.substring(0, 100);
  }

  return name;
}

/**
 * Extract variables used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{[^}]+\}/g) || [];
  return [...new Set(matches)];
}

/**
 * Validate template contains at least one variable
 */
export function hasTemplateVariables(template: string): boolean {
  return /\{[^}]+\}/.test(template);
}
