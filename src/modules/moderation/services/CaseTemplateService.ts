/**
 * CaseTemplateService - Manages reusable moderation case templates
 *
 * Templates allow moderators to quickly apply common actions with
 * pre-defined reasons and durations.
 */

import { container } from '@sapphire/framework';
import { ModAction } from '@prisma/client';
import type { GuildId, UserId, CaseNumber, DurationSeconds } from '../domain/types.js';
import { moderationService } from './ModerationService.js';
import { parseDurationToSeconds } from '#lib/interaction/typedOptions.js';

/**
 * Case template data
 */
export interface CaseTemplateData {
  id: string;
  guildId: GuildId;
  name: string;
  action: ModAction;
  reason: string;
  duration: string | null;
  createdById: UserId;
  createdAt: Date;
}

/**
 * Input for creating a template
 */
export interface CreateTemplateInput {
  guildId: GuildId;
  name: string;
  action: ModAction;
  reason: string;
  duration?: string;
  createdById: UserId;
}

/**
 * Result from template operations
 */
export interface TemplateResult {
  success: boolean;
  template?: CaseTemplateData;
  error?: string;
}

/**
 * Result from applying a template
 */
export interface ApplyTemplateResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
}

/**
 * CaseTemplateService - Handles template management
 */
class CaseTemplateServiceImpl {
  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<TemplateResult> {
    try {
      // Check if name already exists
      const existing = await container.prisma.caseTemplate.findUnique({
        where: {
          guildId_name: {
            guildId: input.guildId,
            name: input.name,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          error: `Template "${input.name}" already exists`,
        };
      }

      const template = await container.prisma.caseTemplate.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          action: input.action,
          reason: input.reason,
          duration: input.duration ?? null,
          createdById: input.createdById,
        },
      });

      return {
        success: true,
        template: this.mapToTemplateData(template),
      };
    } catch (error) {
      container.logger.error('[CaseTemplateService] Error creating template:', error);
      return {
        success: false,
        error: 'Failed to create template',
      };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    guildId: GuildId,
    name: string,
    updates: Partial<Pick<CreateTemplateInput, 'action' | 'reason' | 'duration'>>
  ): Promise<TemplateResult> {
    try {
      const template = await container.prisma.caseTemplate.update({
        where: {
          guildId_name: {
            guildId,
            name,
          },
        },
        data: {
          action: updates.action,
          reason: updates.reason,
          duration: updates.duration,
        },
      });

      return {
        success: true,
        template: this.mapToTemplateData(template),
      };
    } catch (error) {
      container.logger.error('[CaseTemplateService] Error updating template:', error);
      return {
        success: false,
        error: 'Failed to update template',
      };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(guildId: GuildId, name: string): Promise<TemplateResult> {
    try {
      await container.prisma.caseTemplate.delete({
        where: {
          guildId_name: {
            guildId,
            name,
          },
        },
      });

      return { success: true };
    } catch (error) {
      container.logger.error('[CaseTemplateService] Error deleting template:', error);
      return {
        success: false,
        error: 'Failed to delete template',
      };
    }
  }

  /**
   * Get a template by name
   */
  async getTemplate(guildId: GuildId, name: string): Promise<CaseTemplateData | null> {
    const template = await container.prisma.caseTemplate.findUnique({
      where: {
        guildId_name: {
          guildId,
          name,
        },
      },
    });

    return template ? this.mapToTemplateData(template) : null;
  }

  /**
   * List all templates for a guild
   */
  async listTemplates(guildId: GuildId, action?: ModAction): Promise<CaseTemplateData[]> {
    const where: Record<string, unknown> = { guildId };

    if (action) {
      where.action = action;
    }

    const templates = await container.prisma.caseTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => this.mapToTemplateData(t));
  }

  /**
   * Apply a template to a user (creates a case)
   */
  async applyTemplate(
    guildId: GuildId,
    templateName: string,
    targetId: UserId,
    targetTag: string,
    moderatorId: UserId,
    moderatorTag: string
  ): Promise<ApplyTemplateResult> {
    try {
      const template = await this.getTemplate(guildId, templateName);

      if (!template) {
        return {
          success: false,
          error: `Template "${templateName}" not found`,
        };
      }

      // Parse duration if present
      let durationSeconds: number | undefined;
      let expiresAt: Date | undefined;

      if (template.duration) {
        durationSeconds = parseDurationToSeconds(template.duration) ?? undefined;
        if (durationSeconds) {
          expiresAt = new Date(Date.now() + durationSeconds * 1000);
        }
      }

      // Create the case
      const modCase = await moderationService.createCase({
        guildId,
        action: template.action,
        targetId,
        targetTag,
        moderatorId,
        moderatorTag,
        reason: template.reason,
        duration: durationSeconds as DurationSeconds | undefined,
        expiresAt,
      });

      if (!modCase) {
        return {
          success: false,
          error: 'Failed to create case',
        };
      }

      return {
        success: true,
        caseNumber: modCase.caseNumber as CaseNumber,
      };
    } catch (error) {
      container.logger.error('[CaseTemplateService] Error applying template:', error);
      return {
        success: false,
        error: 'Failed to apply template',
      };
    }
  }

  /**
   * Get quick templates for panel display (limited subset)
   */
  async getQuickTemplates(guildId: GuildId, limit: number = 5): Promise<CaseTemplateData[]> {
    const templates = await container.prisma.caseTemplate.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return templates.map((t) => this.mapToTemplateData(t));
  }

  /**
   * Map database record to TemplateData
   */
  private mapToTemplateData(template: {
    id: string;
    guildId: string;
    name: string;
    action: ModAction;
    reason: string;
    duration: string | null;
    createdById: string;
    createdAt: Date;
  }): CaseTemplateData {
    return {
      id: template.id,
      guildId: template.guildId as GuildId,
      name: template.name,
      action: template.action,
      reason: template.reason,
      duration: template.duration,
      createdById: template.createdById as UserId,
      createdAt: template.createdAt,
    };
  }
}

// Export singleton instance
export const caseTemplateService = new CaseTemplateServiceImpl();
