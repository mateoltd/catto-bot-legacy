import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';

/** Mod dashboard permission keys to check */
const DASHBOARD_PERMISSIONS = [
  'mod.evidence.add',
  'mod.evidence.list',
  'mod.evidence.view',
  'mod.evidence.capture',
  'mod.case',
  'mod.history',
  'mod.warn',
  'mod.kick',
  'mod.ban',
  'mod.timeout',
  'mod.note.add',
  'mod.note.list',
  'mod.panel',
] as const;

export class DashboardAccessRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/dashboard-access',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;
    if (!guildId) return response.status(400).json({ error: 'Guild ID is required' });

    try {
      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate)
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });

      // Check all dashboard-relevant permissions
      const permissions: Record<string, { allowed: boolean; reason?: string }> = {};

      for (const key of DASHBOARD_PERMISSIONS) {
        const result = await gate.checkAuth(key);
        permissions[key] = {
          allowed: result.ok,
          reason: result.ok ? undefined : result.code,
        };
      }

      // Determine accessible sections
      const canViewCases = permissions['mod.case']?.allowed || permissions['mod.history']?.allowed;
      const canViewEvidence = permissions['mod.evidence.view']?.allowed;
      const canAddEvidence = permissions['mod.evidence.add']?.allowed;
      const canCaptureEvidence = permissions['mod.evidence.capture']?.allowed;
      const hasAnyAccess = gate.isAdmin || Object.values(permissions).some((p) => p.allowed);

      return response.json({
        userId: gate.userId,
        guildId,
        isAdmin: gate.isAdmin,
        isOwner: gate.isOwner,
        hasAccess: hasAnyAccess,
        sections: {
          cases: canViewCases,
          evidence: canViewEvidence,
          evidenceAdd: canAddEvidence,
          evidenceCapture: canCaptureEvidence,
        },
        permissions,
      });
    } catch (error) {
      this.container.logger.error('Error checking dashboard access:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
