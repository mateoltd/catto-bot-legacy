/**
 * API Gate - REST API authorization middleware
 *
 * Provides authorization, rate limiting, and weight tracking for REST API routes.
 * Resolves dashboard session cookies to Discord guild members
 * and delegates permission checks to the existing permission system.
 */

import { container } from '@sapphire/framework';
import type { Guild, GuildMember } from 'discord.js';
import {
  checkCommandAccess,
  checkResourceAccess,
  type ResourceAccessResult,
} from './permissionResolver.js';
import { RateLimitGate, type RateLimitOptions, type RateLimitResult } from './RateLimitGate.js';
import { WeightGate, type WeightResult } from './WeightGate.js';
import type { Route } from '@sapphire/plugin-api';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { getOrSetJson, CacheKey } from '#lib/cache/typedCache.js';
import { extractSessionId, isSessionId, resolveSession } from '#lib/session.js';
import { z } from 'zod';

export interface ApiGateResult {
  ok: boolean;
  code?: string;
  message?: string;
  metadata?: {
    disabledReason?: string;
    retryAfterMs?: number;
    weightUsed?: number;
    weightMax?: number;
  };
}

export interface ResourceContext {
  caseId?: string;
  ownerId?: string;
}

export interface GateCheck {
  type: 'auth' | 'resource_auth' | 'rate_limit' | 'weight';
  commandKey?: string;
  resourceContext?: ResourceContext;
  actionKey?: string;
  rateLimitOptions?: RateLimitOptions;
  weightBytes?: number;
  maxWeightBytes?: number;
}

const discordUserSchema = z.object({ id: z.string() }).passthrough();

function apiPass(): ApiGateResult {
  return { ok: true };
}

function apiFail(
  code: string,
  message: string,
  metadata?: ApiGateResult['metadata']
): ApiGateResult {
  return { ok: false, code, message, metadata };
}

export class ApiGate {
  private constructor(
    public readonly userId: string,
    public readonly guildId: string,
    public readonly member: GuildMember,
    public readonly guild: Guild
  ) {}

  /**
   * Create an ApiGate from an HTTP request by resolving the session cookie
   * (or legacy raw token) to a Discord guild member.
   */
  static async fromRequest(request: Route.Request, guildId: string): Promise<ApiGate | null> {
    try {
      const value = extractSessionId(request);
      if (!value) return null;

      let userId: string | null = null;

      // New path: session ID → resolve from Redis (no Discord API call)
      if (isSessionId(value)) {
        const session = await resolveSession(value);
        if (!session) return null;
        userId = session.userId;
      } else {
        // Legacy path: raw Discord access token — validate via Discord API
        const tokenHash = createHash('sha256').update(value).digest('hex').slice(0, 16);
        let userData: { id: string } | null = null;

        try {
          userData = await getOrSetJson(
            CacheKey.discordUser(tokenHash),
            discordUserSchema,
            async () => {
              const response = await axios.get('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bearer ${value}` },
                validateStatus: () => true,
              });
              if (response.status !== 200) throw new Error('Discord API returned non-200');
              return response.data;
            },
            60
          );
        } catch {
          // Redis unavailable or Discord API error — fall back to direct call
          const response = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${value}` },
            validateStatus: () => true,
          });
          if (response.status !== 200) return null;
          userData = response.data as { id: string };
        }

        if (!userData?.id) return null;
        userId = userData.id;
      }

      // Get the guild
      const discordGuild = container.client.guilds.cache.get(guildId);
      if (!discordGuild) return null;

      // Resolve the member
      let member: GuildMember;
      try {
        member = await discordGuild.members.fetch(userId);
      } catch {
        return null;
      }

      return new ApiGate(userId, guildId, member, discordGuild);
    } catch {
      return null;
    }
  }

  /**
   * Check command-level authorization.
   */
  async checkAuth(commandKey: string): Promise<ApiGateResult> {
    if (this.isAdmin) return apiPass();

    const result = await checkCommandAccess(this.member, commandKey);
    if (result.allowed) return apiPass();

    return apiFail(
      result.reason === 'explicit_deny' || result.reason === 'category_deny'
        ? 'EXPLICIT_DENY'
        : 'NO_PERMISSION',
      `Permission denied for ${commandKey}`,
      {
        disabledReason:
          result.reason === 'explicit_deny' || result.reason === 'category_deny'
            ? 'You have been explicitly denied access.'
            : 'You do not have the required permission.',
      }
    );
  }

  /**
   * Require command-level authorization (returns true if allowed).
   */
  async requireAuth(commandKey: string): Promise<boolean> {
    const result = await this.checkAuth(commandKey);
    return result.ok;
  }

  /**
   * Check resource-level authorization with optional context.
   */
  async checkResourceAuth(commandKey: string, context?: ResourceContext): Promise<ApiGateResult> {
    if (this.isAdmin) return apiPass();

    const result: ResourceAccessResult = await checkResourceAccess(
      this.member,
      commandKey,
      context
    );
    if (result.allowed) return apiPass();

    return apiFail('INSUFFICIENT_SCOPE', `Resource access denied for ${commandKey}`, {
      disabledReason: result.metadata?.disabledReason ?? 'Insufficient permissions.',
    });
  }

  /**
   * Check rate limit for an action.
   */
  async checkRateLimit(actionKey: string, options: RateLimitOptions): Promise<ApiGateResult> {
    const result: RateLimitResult = await RateLimitGate.check(this.userId, actionKey, options);
    if (result.allowed) return apiPass();

    return apiFail('RATE_LIMITED', 'Rate limit exceeded', {
      retryAfterMs: result.retryAfterMs,
    });
  }

  /**
   * Check upload weight for rate-limited upload tracking.
   */
  async checkWeight(
    _actionKey: string,
    weightBytes: number,
    maxWeightBytes?: number
  ): Promise<ApiGateResult> {
    const result: WeightResult = await WeightGate.checkUploadWeight(
      this.userId,
      this.guildId,
      weightBytes,
      maxWeightBytes
    );

    if (result.allowed) return apiPass();

    return apiFail('WEIGHT_EXCEEDED', 'Upload weight limit exceeded', {
      weightUsed: result.used,
      weightMax: result.max,
    });
  }

  /**
   * Run multiple gate checks in sequence. Returns the first failure, or pass.
   */
  async requireAll(checks: GateCheck[]): Promise<ApiGateResult> {
    for (const check of checks) {
      let result: ApiGateResult;

      switch (check.type) {
        case 'auth':
          result = await this.checkAuth(check.commandKey!);
          break;
        case 'resource_auth':
          result = await this.checkResourceAuth(check.commandKey!, check.resourceContext);
          break;
        case 'rate_limit':
          result = await this.checkRateLimit(check.actionKey!, check.rateLimitOptions!);
          break;
        case 'weight':
          result = await this.checkWeight(
            check.actionKey!,
            check.weightBytes!,
            check.maxWeightBytes
          );
          break;
        default:
          continue;
      }

      if (!result.ok) return result;
    }

    return apiPass();
  }

  /**
   * Log a gate check to ModEvent for audit trail.
   */
  async logCheck(
    action: string,
    result: ApiGateResult,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      await container.prisma.modEvent.create({
        data: {
          guildId: this.guildId,
          actorId: this.userId,
          actorType: 'user',
          action,
          category: 'PERMISSION_CHECK',
          success: result.ok,
          errorType: result.ok ? undefined : result.code,
          metadata: {
            ...context,
            code: result.code,
            message: result.message,
          },
        },
      });
    } catch {
      // Non-critical: don't fail the request if logging fails
    }
  }

  /** Check if the member has Administrator permission. */
  get isAdmin(): boolean {
    return this.member.permissions.has('Administrator');
  }

  /** Check if the member is the server owner. */
  get isOwner(): boolean {
    return this.member.id === this.guild.ownerId;
  }
}
