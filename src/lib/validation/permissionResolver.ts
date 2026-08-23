import { container } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { z } from 'zod';
import { getJson, setJson, deleteJson } from '#lib/cache/typedCache.js';
import { categoriesForCommand, fallbackDiscordPermissionForCommand } from './permissionRegistry.js';
import type {
  PermissionEffect,
  PermissionResourceType,
  PermissionSubjectType,
} from '@prisma/client';

const CACHE_TTL_SECONDS = 300; // 5 minutes

export interface PermissionGrant {
  id: string;
  guildId: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  resourceType: PermissionResourceType;
  resourceKey: string;
  effect: PermissionEffect;
  createdById: string | null;
  createdAt: Date;
}

export interface CommandAccessResult {
  allowed: boolean;
  reason:
    | 'explicit_allow'
    | 'explicit_deny'
    | 'category_allow'
    | 'category_deny'
    | 'discord_fallback'
    | 'public';
  source?: {
    type: 'user' | 'role';
    id: string;
    resourceType: 'COMMAND' | 'CATEGORY';
    resourceKey: string;
  };
}

const PermissionGrantSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  subjectType: z.enum(['USER', 'ROLE']),
  subjectId: z.string(),
  resourceType: z.enum(['COMMAND', 'CATEGORY', 'RESOURCE']),
  resourceKey: z.string(),
  effect: z.enum(['ALLOW', 'DENY']),
  createdById: z.string().nullable(),
  createdAt: z.string().transform((s) => new Date(s)),
});

const GrantsArraySchema = z.array(PermissionGrantSchema);

function guildGrantsCacheKey(guildId: string): string {
  return `permissions:grants:${guildId}`;
}

export async function getGuildGrants(guildId: string): Promise<PermissionGrant[]> {
  const cacheKey = guildGrantsCacheKey(guildId);

  const cached = await getJson(cacheKey, GrantsArraySchema).catch(() => null);
  if (cached) {
    return cached;
  }

  const grants = await container.prisma.permissionGrant.findMany({
    where: { guildId },
  });

  const serializable = grants.map((g) => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
  }));

  await setJson(cacheKey, GrantsArraySchema, serializable, CACHE_TTL_SECONDS).catch(() => {});

  return grants;
}

export async function invalidateGuildGrantsCache(guildId: string): Promise<void> {
  await deleteJson(guildGrantsCacheKey(guildId)).catch(() => {});
}

export async function checkCommandAccess(
  member: GuildMember,
  commandKey: string
): Promise<CommandAccessResult> {
  const guildId = member.guild.id;
  const userId = member.id;
  const roleIds = [...member.roles.cache.keys()];

  const grants = await getGuildGrants(guildId);

  const commandCategories = categoriesForCommand(commandKey);

  const userGrants = grants.filter((g) => g.subjectType === 'USER' && g.subjectId === userId);
  const roleGrants = grants.filter(
    (g) => g.subjectType === 'ROLE' && roleIds.includes(g.subjectId)
  );

  const userCommandDeny = userGrants.find(
    (g) => g.resourceType === 'COMMAND' && g.resourceKey === commandKey && g.effect === 'DENY'
  );
  if (userCommandDeny) {
    return {
      allowed: false,
      reason: 'explicit_deny',
      source: { type: 'user', id: userId, resourceType: 'COMMAND', resourceKey: commandKey },
    };
  }

  const userCommandAllow = userGrants.find(
    (g) => g.resourceType === 'COMMAND' && g.resourceKey === commandKey && g.effect === 'ALLOW'
  );
  if (userCommandAllow) {
    return {
      allowed: true,
      reason: 'explicit_allow',
      source: { type: 'user', id: userId, resourceType: 'COMMAND', resourceKey: commandKey },
    };
  }

  for (const roleGrant of roleGrants) {
    if (
      roleGrant.resourceType === 'COMMAND' &&
      roleGrant.resourceKey === commandKey &&
      roleGrant.effect === 'DENY'
    ) {
      return {
        allowed: false,
        reason: 'explicit_deny',
        source: {
          type: 'role',
          id: roleGrant.subjectId,
          resourceType: 'COMMAND',
          resourceKey: commandKey,
        },
      };
    }
  }

  for (const roleGrant of roleGrants) {
    if (
      roleGrant.resourceType === 'COMMAND' &&
      roleGrant.resourceKey === commandKey &&
      roleGrant.effect === 'ALLOW'
    ) {
      return {
        allowed: true,
        reason: 'explicit_allow',
        source: {
          type: 'role',
          id: roleGrant.subjectId,
          resourceType: 'COMMAND',
          resourceKey: commandKey,
        },
      };
    }
  }

  for (const category of commandCategories) {
    const userCategoryDeny = userGrants.find(
      (g) => g.resourceType === 'CATEGORY' && g.resourceKey === category && g.effect === 'DENY'
    );
    if (userCategoryDeny) {
      return {
        allowed: false,
        reason: 'category_deny',
        source: { type: 'user', id: userId, resourceType: 'CATEGORY', resourceKey: category },
      };
    }
  }

  for (const category of commandCategories) {
    const userCategoryAllow = userGrants.find(
      (g) => g.resourceType === 'CATEGORY' && g.resourceKey === category && g.effect === 'ALLOW'
    );
    if (userCategoryAllow) {
      return {
        allowed: true,
        reason: 'category_allow',
        source: { type: 'user', id: userId, resourceType: 'CATEGORY', resourceKey: category },
      };
    }
  }

  for (const category of commandCategories) {
    for (const roleGrant of roleGrants) {
      if (
        roleGrant.resourceType === 'CATEGORY' &&
        roleGrant.resourceKey === category &&
        roleGrant.effect === 'DENY'
      ) {
        return {
          allowed: false,
          reason: 'category_deny',
          source: {
            type: 'role',
            id: roleGrant.subjectId,
            resourceType: 'CATEGORY',
            resourceKey: category,
          },
        };
      }
    }
  }

  for (const category of commandCategories) {
    for (const roleGrant of roleGrants) {
      if (
        roleGrant.resourceType === 'CATEGORY' &&
        roleGrant.resourceKey === category &&
        roleGrant.effect === 'ALLOW'
      ) {
        return {
          allowed: true,
          reason: 'category_allow',
          source: {
            type: 'role',
            id: roleGrant.subjectId,
            resourceType: 'CATEGORY',
            resourceKey: category,
          },
        };
      }
    }
  }

  const fallbackPerm = fallbackDiscordPermissionForCommand(commandKey);
  if (fallbackPerm) {
    const hasDiscordPerm = member.permissions.has(fallbackPerm);
    return {
      allowed: hasDiscordPerm,
      reason: 'discord_fallback',
    };
  }

  return { allowed: true, reason: 'public' };
}

/**
 * Resource-level access result with additional metadata for dashboard UI
 */
export interface ResourceAccessResult extends CommandAccessResult {
  metadata?: {
    disabledReason?: string;
    requiredPermission?: string;
    grantSource?: string;
  };
}

/**
 * Check resource-level access with optional context (e.g., case ownership).
 * Delegates to checkCommandAccess for the core permission check,
 * then layers on resource-specific context.
 *
 * NOTE: Currently, resourceContext is accepted but not used for access decisions.
 * This means users with a permission like `mod.evidence.view` can access ANY
 * evidence in the guild, not just evidence from cases they own or are assigned to.
 * Resource-level scoping (e.g., "view only your own cases") requires additional
 * RESOURCE-type grants in the database, which is a planned future enhancement.
 */
export async function checkResourceAccess(
  member: GuildMember,
  resourceKey: string,
  resourceContext?: {
    caseId?: string;
    ownerId?: string;
  }
): Promise<ResourceAccessResult> {
  const baseResult = await checkCommandAccess(member, resourceKey);

  // Resource context is available for future fine-grained access control.
  // For now, we only log when context is provided but not enforced.
  if (resourceContext?.ownerId && resourceContext.ownerId !== member.id) {
    container.logger.debug(
      `[checkResourceAccess] Context provided but not enforced: user=${member.id}, owner=${resourceContext.ownerId}, resource=${resourceKey}`
    );
  }

  return {
    ...baseResult,
    metadata: baseResult.allowed
      ? undefined
      : {
          disabledReason:
            baseResult.reason === 'explicit_deny' || baseResult.reason === 'category_deny'
              ? 'You have been explicitly denied access to this resource.'
              : 'You do not have the required permission.',
          requiredPermission: resourceKey,
          grantSource: baseResult.source
            ? `${baseResult.source.type}:${baseResult.source.id}`
            : undefined,
        },
  };
}

export async function checkModPanelActionAccess(
  member: GuildMember,
  actionKey: string
): Promise<CommandAccessResult> {
  return checkCommandAccess(member, actionKey);
}

export async function getAllowedModPanelActions(member: GuildMember): Promise<Set<string>> {
  const modPanelActions = [
    'mod.warn',
    'mod.kick',
    'mod.ban',
    'mod.softban',
    'mod.timeout',
    'mod.tempban',
    'mod.mute.text',
    'mod.mute.voice',
    'mod.unmute.both',
    'mod.note.add',
    'mod.note.list',
    'mod.context',
    'mod.history',
    'mod.panel',
  ];

  const allowed = new Set<string>();

  const results = await Promise.all(
    modPanelActions.map(async (action) => {
      const result = await checkCommandAccess(member, action);
      return { action, allowed: result.allowed };
    })
  );

  for (const { action, allowed: isAllowed } of results) {
    if (isAllowed) {
      allowed.add(action);
    }
  }

  return allowed;
}

export async function hasAnyModPanelAccess(member: GuildMember): Promise<boolean> {
  const allowed = await getAllowedModPanelActions(member);
  return allowed.size > 0;
}

export async function createPermissionGrant(
  guildId: string,
  subjectType: PermissionSubjectType,
  subjectId: string,
  resourceType: PermissionResourceType,
  resourceKey: string,
  effect: PermissionEffect,
  createdById?: string
): Promise<PermissionGrant> {
  const grant = await container.prisma.permissionGrant.upsert({
    where: {
      guildId_subjectType_subjectId_resourceType_resourceKey: {
        guildId,
        subjectType,
        subjectId,
        resourceType,
        resourceKey,
      },
    },
    update: {
      effect,
      createdById: createdById ?? null,
    },
    create: {
      guildId,
      subjectType,
      subjectId,
      resourceType,
      resourceKey,
      effect,
      createdById: createdById ?? null,
    },
  });

  await invalidateGuildGrantsCache(guildId);

  return grant;
}

export async function removePermissionGrant(
  guildId: string,
  subjectType: PermissionSubjectType,
  subjectId: string,
  resourceType: PermissionResourceType,
  resourceKey: string
): Promise<boolean> {
  try {
    await container.prisma.permissionGrant.delete({
      where: {
        guildId_subjectType_subjectId_resourceType_resourceKey: {
          guildId,
          subjectType,
          subjectId,
          resourceType,
          resourceKey,
        },
      },
    });

    await invalidateGuildGrantsCache(guildId);
    return true;
  } catch {
    return false;
  }
}

export async function listPermissionGrants(
  guildId: string,
  filters?: {
    subjectType?: PermissionSubjectType;
    subjectId?: string;
    resourceType?: PermissionResourceType;
    resourceKey?: string;
  }
): Promise<PermissionGrant[]> {
  const where: Record<string, unknown> = { guildId };

  if (filters?.subjectType) where.subjectType = filters.subjectType;
  if (filters?.subjectId) where.subjectId = filters.subjectId;
  if (filters?.resourceType) where.resourceType = filters.resourceType;
  if (filters?.resourceKey) where.resourceKey = filters.resourceKey;

  return container.prisma.permissionGrant.findMany({ where });
}
