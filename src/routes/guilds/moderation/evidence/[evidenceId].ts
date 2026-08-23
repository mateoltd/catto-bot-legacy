import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';
import { evidenceService } from '#modules/moderation/services/EvidenceService.js';
import { accessLogService } from '#modules/moderation/services/AccessLogService.js';
import { watermarkService } from '#modules/moderation/services/WatermarkService.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class EvidenceDetailRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/evidence/[evidenceId]',
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, evidenceId } = request.params;
    if (!guildId || !evidenceId) {
      return response.status(400).json({ error: 'Guild ID and Evidence ID are required' });
    }

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate)
      return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });

    const auth = await gate.checkAuth('mod.evidence.view');
    if (!auth.ok)
      return response
        .status(403)
        .json({ error: 'Forbidden', code: auth.code, metadata: auth.metadata });

    const rateLimit = await gate.checkRateLimit(
      'evidence.view',
      RateLimitGate.LIMITS['evidence.view']!
    );
    if (!rateLimit.ok)
      return response
        .status(429)
        .json({ error: 'Rate Limited', retryAfterMs: rateLimit.metadata?.retryAfterMs });

    // Route based on the sub-action in query or body
    const subAction = (request.query?.action as string) ?? '';

    try {
      if (request.method === 'GET') {
        switch (subAction) {
          case 'view-url':
            return this.handleViewUrl(gate, evidenceId, guildId, request, response);
          case 'download-url':
            return this.handleDownloadUrl(gate, evidenceId, guildId, request, response);
          case 'watermarked-download':
            return this.handleWatermarkedDownload(gate, evidenceId, guildId, request, response);
          case 'access-log':
            return this.handleAccessLog(gate, evidenceId, guildId, request, response);
          case 'history':
            return this.handleHistory(evidenceId, guildId, response);
          default:
            return this.handleGetDetail(evidenceId, guildId, response);
        }
      }

      if (request.method === 'POST') {
        const body = ((await parseRequestBody(request)) ?? {}) as Record<string, unknown>;
        const postAction = body?.action as string;

        switch (postAction) {
          case 'add-timestamp':
            return this.handleAddTimestamp(gate, evidenceId, guildId, body, response);
          case 'remove-timestamp':
            return this.handleRemoveTimestamp(gate, evidenceId, guildId, body, response);
          default:
            return this.handleAmend(gate, evidenceId, guildId, body, response);
        }
      }

      return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      this.container.logger.error('Error in evidence detail route:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}
   * Get single evidence item with all details.
   */
  private async handleGetDetail(evidenceId: string, guildId: string, response: Route.Response) {
    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });

    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    return response.json(evidence);
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}?action=view-url
   * Get a presigned view URL for an evidence file.
   */
  private async handleViewUrl(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      const evidence = await evidenceService.getEvidenceById(evidenceId);
      if (!evidence) return response.status(404).json({ error: 'Evidence not found' });

      // Verify user has access to this specific case
      const caseAuth = await gate.checkResourceAuth('mod.evidence.view', {
        caseId: evidence.caseId,
      });
      if (!caseAuth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: caseAuth.code });
      }

      const url = await evidenceService.generateViewUrl(evidenceId);

      // Log access only after successful URL generation (NH-9)
      await accessLogService.logAccess(
        evidenceId,
        guildId,
        gate.userId,
        gate.member.user.tag,
        'VIEW',
        request
      );

      return response.json({ url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate view URL';
      return response.status(400).json({ error: message });
    }
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}?action=download-url
   * Get a presigned download URL for an evidence file.
   */
  private async handleDownloadUrl(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      const evidence = await evidenceService.getEvidenceById(evidenceId);
      if (!evidence) return response.status(404).json({ error: 'Evidence not found' });

      // Verify user has access to this specific case
      const caseAuth = await gate.checkResourceAuth('mod.evidence.view', {
        caseId: evidence.caseId,
      });
      if (!caseAuth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: caseAuth.code });
      }

      const url = await evidenceService.generateDownloadUrl(evidenceId);

      // Log access only after successful URL generation (NH-9)
      await accessLogService.logAccess(
        evidenceId,
        guildId,
        gate.userId,
        gate.member.user.tag,
        'DOWNLOAD',
        request
      );

      return response.json({ url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate download URL';
      return response.status(400).json({ error: message });
    }
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}?action=watermarked-download
   * Get a watermarked download URL (NH-8).
   */
  private async handleWatermarkedDownload(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      const evidence = await evidenceService.getEvidenceById(evidenceId);
      if (!evidence) return response.status(404).json({ error: 'Evidence not found' });

      // Verify user has access to this specific case
      const caseAuth = await gate.checkResourceAuth('mod.evidence.view', {
        caseId: evidence.caseId,
      });
      if (!caseAuth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: caseAuth.code });
      }

      // Check if watermarking is enabled for this guild (default: true)
      const config = await this.container.prisma.modConfig.findUnique({
        where: { guildId },
      });
      const watermarkEnabled = config?.watermarkDownloads ?? true;

      if (!watermarkEnabled) {
        // Fall back to regular download
        const url = await evidenceService.generateDownloadUrl(evidenceId);
        await accessLogService.logAccess(
          evidenceId,
          guildId,
          gate.userId,
          gate.member.user.tag,
          'DOWNLOAD',
          request
        );
        return response.json({ url, watermarked: false });
      }

      // Get watermarked URL
      const watermarkText = config?.watermarkText ?? gate.member.user.tag;
      const result = await watermarkService.getWatermarkedUrl(evidenceId, guildId, watermarkText);

      // Log access only after successful generation
      await accessLogService.logAccess(
        evidenceId,
        guildId,
        gate.userId,
        gate.member.user.tag,
        'DOWNLOAD',
        request,
        { watermarked: true }
      );

      return response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate watermarked URL';
      return response.status(400).json({ error: message });
    }
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}?action=access-log
   * Get access log for evidence (NH-9).
   */
  private async handleAccessLog(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    // Require audit permission
    const auditAuth = await gate.checkAuth('mod.evidence.audit' as never);
    if (!auditAuth.ok) {
      // Fall back to view permission if audit doesn't exist
      const viewAuth = await gate.checkAuth('mod.evidence.view');
      if (!viewAuth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: viewAuth.code });
      }
    }

    // Verify evidence exists and belongs to this guild
    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });
    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    const page = Math.max(1, parseInt((request.query?.page as string) ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt((request.query?.limit as string) ?? '50', 10) || 50)
    );

    const result = await accessLogService.getAccessLog(evidenceId, { page, limit });
    return response.json(result);
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence/{evidenceId}?action=history
   * Get amendment history for an evidence item.
   */
  private async handleHistory(evidenceId: string, guildId: string, response: Route.Response) {
    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });

    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    const history = await evidenceService.getEvidenceHistory(evidenceId);
    return response.json({ history });
  }

  /**
   * POST /guilds/{guildId}/moderation/evidence/{evidenceId}
   * Add an amendment to the evidence item (default action).
   */
  private async handleAmend(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    body: Record<string, unknown>,
    response: Route.Response
  ) {
    const addAuth = await gate.checkAuth('mod.evidence.add');
    if (!addAuth.ok) return response.status(403).json({ error: 'Forbidden', code: addAuth.code });

    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });
    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    const { action, newValue, reason } = body as {
      action: string;
      newValue?: string;
      reason?: string;
    };

    if (!action) {
      return response
        .status(400)
        .json({ error: 'action is required (e.g., NOTE_ADDED, DESCRIPTION_UPDATED)' });
    }

    const amendment = await evidenceService.amendEvidence({
      evidenceId,
      amendedById: gate.userId,
      amendedByTag: gate.member.user.tag,
      action,
      newValue,
      reason,
    });

    return response.json(amendment);
  }

  /**
   * POST /guilds/{guildId}/moderation/evidence/{evidenceId} with action=add-timestamp
   * Add a timestamp annotation to video evidence (NH-4).
   */
  private async handleAddTimestamp(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    body: Record<string, unknown>,
    response: Route.Response
  ) {
    const addAuth = await gate.checkAuth('mod.evidence.add');
    if (!addAuth.ok) return response.status(403).json({ error: 'Forbidden', code: addAuth.code });

    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });
    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    const { time, note } = body as { time: number; note: string };

    if (typeof time !== 'number' || time < 0) {
      return response.status(400).json({ error: 'time is required and must be >= 0' });
    }
    if (!note || typeof note !== 'string') {
      return response.status(400).json({ error: 'note is required' });
    }

    const updated = await evidenceService.addTimestamp(evidenceId, {
      time,
      note,
      addedById: gate.userId,
      addedByTag: gate.member.user.tag,
    });

    return response.json(updated);
  }

  /**
   * POST /guilds/{guildId}/moderation/evidence/{evidenceId} with action=remove-timestamp
   * Remove a timestamp annotation from video evidence (NH-4).
   */
  private async handleRemoveTimestamp(
    gate: ApiGate,
    evidenceId: string,
    guildId: string,
    body: Record<string, unknown>,
    response: Route.Response
  ) {
    const addAuth = await gate.checkAuth('mod.evidence.add');
    if (!addAuth.ok) return response.status(403).json({ error: 'Forbidden', code: addAuth.code });

    const evidence = await evidenceService.getEvidenceById(evidenceId);
    if (!evidence) return response.status(404).json({ error: 'Evidence not found' });
    if (evidence.guildId !== guildId) {
      return response.status(404).json({ error: 'Evidence not found' });
    }

    const { timestampId } = body as { timestampId: string };

    if (!timestampId) {
      return response.status(400).json({ error: 'timestampId is required' });
    }

    const updated = await evidenceService.removeTimestamp(
      evidenceId,
      timestampId,
      gate.userId,
      gate.member.user.tag
    );

    return response.json(updated);
  }
}
