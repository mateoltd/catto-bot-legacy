import { Route } from "@sapphire/plugin-api";
import { ApiGate } from "#lib/validation/ApiGate.js";
import { RateLimitGate } from "#lib/validation/RateLimitGate.js";
import { evidenceService } from "#modules/moderation/services/EvidenceService.js";
import { parseRequestBody } from "#lib/route-utils.js";
import { fetchOGData } from "#lib/utils/ogFetcher.js";
import { CONFIG } from "#config.js";

export class EvidenceRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: "guilds/[guildId]/moderation/evidence",
      methods: ["GET", "POST"],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;
    if (!guildId)
      return response.status(400).json({ error: "Guild ID is required" });

    if (request.method === "GET")
      return this.handleGet(request, response, guildId);
    if (request.method === "POST")
      return this.handlePost(request, response, guildId);

    return response.status(405).json({ error: "Method not allowed" });
  }

  /**
   * GET /guilds/{guildId}/moderation/evidence?caseNumber=X
   * List evidence for a case.
   */
  private async handleGet(
    request: Route.Request,
    response: Route.Response,
    guildId: string,
  ) {
    try {
      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate)
        return response
          .status(401)
          .json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" });

      const rateLimit = await gate.checkRateLimit(
        "evidence.view",
        RateLimitGate.LIMITS["evidence.view"]!,
      );
      if (!rateLimit.ok)
        return response.status(429).json({
          error: "Rate Limited",
          retryAfterMs: rateLimit.metadata?.retryAfterMs,
        });

      const caseNumber = parseInt((request.query?.caseNumber as string) ?? "0");
      const search = (request.query?.search as string) || undefined;
      const page = parseInt((request.query?.page as string) ?? "1");
      const limit = parseInt((request.query?.limit as string) ?? "50");
      const type = (request.query?.type as string) || undefined;
      const status = (request.query?.status as string) || undefined;
      const filterCaseNumber =
        caseNumber ||
        parseInt((request.query?.case as string) ?? "0") ||
        undefined;
      const tagsParam = (request.query?.tags as string) || undefined;
      const tags = tagsParam
        ? tagsParam
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined;

      // Per-case evidence: allow if user can view cases OR view evidence
      if (caseNumber && caseNumber >= 1) {
        const caseAuth = await gate.checkAuth("mod.case");
        const evidenceAuth = caseAuth.ok
          ? caseAuth
          : await gate.checkAuth("mod.evidence.view");
        if (!evidenceAuth.ok)
          return response.status(403).json({
            error: "Forbidden",
            code: evidenceAuth.code,
            metadata: evidenceAuth.metadata,
          });
        const result =
          search && search.length >= 2
            ? await evidenceService.searchEvidence(guildId, search, {
                page,
                limit,
                type,
                status,
                caseNumber,
                tags,
              })
            : await evidenceService.getEvidenceForGuild(guildId, {
                page,
                limit,
                type,
                status,
                caseNumber,
                tags,
              });
        const summary = await evidenceService.getEvidenceSummary(
          guildId,
          caseNumber,
        );
        return response.json({ ...result, summary });
      }

      // Guild-wide evidence browse requires mod.evidence.view
      const evidenceAuth = await gate.checkAuth("mod.evidence.view");
      if (!evidenceAuth.ok)
        return response.status(403).json({
          error: "Forbidden",
          code: evidenceAuth.code,
          metadata: evidenceAuth.metadata,
        });

      // NH-5: Full-text search
      if (search && search.length >= 2) {
        const result = await evidenceService.searchEvidence(guildId, search, {
          page,
          limit,
          type,
          status,
          caseNumber: filterCaseNumber,
          tags,
        });
        return response.json(result);
      }

      // Otherwise, return guild-wide paginated evidence
      const result = await evidenceService.getEvidenceForGuild(guildId, {
        page,
        limit,
        type,
        status,
        caseNumber: filterCaseNumber,
        tags,
      });

      return response.json(result);
    } catch (error) {
      this.container.logger.error("Error fetching evidence:", error);
      return response.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * POST /guilds/{guildId}/moderation/evidence
   * Routes to initiate, confirm, or URL based on the `action` body field.
   */
  private async handlePost(
    request: Route.Request,
    response: Route.Response,
    guildId: string,
  ) {
    try {
      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate)
        return response
          .status(401)
          .json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" });

      const body = ((await parseRequestBody(request)) ?? {}) as Record<
        string,
        unknown
      >;
      const action = body?.action as string;

      switch (action) {
        case "initiate":
          return this.handleInitiate(gate, body, response, guildId);
        case "confirm":
          return this.handleConfirm(gate, body, response);
        case "url":
          return this.handleUrl(gate, body, response, guildId);
        case "preview-og":
          return this.handlePreviewOG(gate, body, response);
        case "bulk-amend":
          return this.handleBulkAmend(gate, body, response);
        default:
          return response.status(400).json({
            error:
              "Unknown action. Use: initiate, confirm, url, preview-og, or bulk-amend",
          });
      }
    } catch (error) {
      this.container.logger.error("Error in evidence POST:", error);
      return response.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Initiate an upload — returns a presigned URL for direct upload.
   */
  private async handleInitiate(
    gate: ApiGate,
    body: Record<string, unknown>,
    response: Route.Response,
    guildId: string,
  ) {
    const auth = await gate.checkAuth("mod.evidence.add");
    if (!auth.ok)
      return response.status(403).json({ error: "Forbidden", code: auth.code });

    const rateLimit = await gate.checkRateLimit(
      "evidence.upload",
      RateLimitGate.LIMITS["evidence.upload"]!,
    );
    if (!rateLimit.ok)
      return response.status(429).json({
        error: "Rate Limited",
        retryAfterMs: rateLimit.metadata?.retryAfterMs,
      });

    const { caseNumber, filename, mimeType, sizeBytes, description, tags } =
      body as {
        caseNumber: number;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        description?: string;
        tags?: string[];
      };

    if (!caseNumber || !filename || !mimeType || !sizeBytes) {
      return response.status(400).json({
        error: "caseNumber, filename, mimeType, and sizeBytes are required",
      });
    }

    // Check weight limit
    const weight = await gate.checkWeight(
      "evidence.upload",
      sizeBytes,
      CONFIG.MAX_EVIDENCE_UPLOAD_BYTES,
    );
    if (!weight.ok)
      return response
        .status(413)
        .json({ error: "Upload limit exceeded", metadata: weight.metadata });

    const result = await evidenceService.initiateUpload({
      guildId,
      caseNumber,
      uploadedById: gate.userId,
      uploadedByTag: gate.member.user.tag,
      filename,
      mimeType,
      sizeBytes,
      description,
      tags,
    });

    return response.json(result);
  }

  /**
   * Confirm an upload — verifies hash and signs.
   */
  private async handleConfirm(
    gate: ApiGate,
    body: Record<string, unknown>,
    response: Route.Response,
  ) {
    const auth = await gate.checkAuth("mod.evidence.add");
    if (!auth.ok)
      return response.status(403).json({ error: "Forbidden", code: auth.code });

    const { evidenceId, contentHash } = body as {
      evidenceId: string;
      contentHash: string;
    };

    if (!evidenceId || !contentHash) {
      return response
        .status(400)
        .json({ error: "evidenceId and contentHash are required" });
    }

    const evidence = await evidenceService.confirmUpload(
      evidenceId,
      contentHash,
    );
    return response.json(evidence);
  }

  /**
   * Add URL-type evidence.
   */
  private async handleUrl(
    gate: ApiGate,
    body: Record<string, unknown>,
    response: Route.Response,
    guildId: string,
  ) {
    const auth = await gate.checkAuth("mod.evidence.add");
    if (!auth.ok)
      return response.status(403).json({ error: "Forbidden", code: auth.code });

    const rateLimit = await gate.checkRateLimit(
      "evidence.upload",
      RateLimitGate.LIMITS["evidence.upload"]!,
    );
    if (!rateLimit.ok)
      return response.status(429).json({
        error: "Rate Limited",
        retryAfterMs: rateLimit.metadata?.retryAfterMs,
      });

    const { caseNumber, url, type, description, tags } = body as {
      caseNumber: number;
      url: string;
      type?: "URL" | "DISCORD_URL";
      description?: string;
      tags?: string[];
    };

    if (!caseNumber || !url) {
      return response
        .status(400)
        .json({ error: "caseNumber and url are required" });
    }

    const evidence = await evidenceService.addUrlEvidence({
      guildId,
      caseNumber,
      uploadedById: gate.userId,
      uploadedByTag: gate.member.user.tag,
      url,
      type: type ?? "URL",
      description,
      tags,
    });

    return response.json(evidence);
  }

  /**
   * Preview OG metadata for a URL without creating evidence.
   */
  private async handlePreviewOG(
    gate: ApiGate,
    body: Record<string, unknown>,
    response: Route.Response,
  ) {
    const auth = await gate.checkAuth("mod.evidence.view");
    if (!auth.ok)
      return response.status(403).json({ error: "Forbidden", code: auth.code });

    const rateLimit = await gate.checkRateLimit(
      "evidence.view",
      RateLimitGate.LIMITS["evidence.view"]!,
    );
    if (!rateLimit.ok)
      return response.status(429).json({
        error: "Rate Limited",
        retryAfterMs: rateLimit.metadata?.retryAfterMs,
      });

    const { url } = body as { url: string };
    if (!url) {
      return response.status(400).json({ error: "url is required" });
    }

    const og = await fetchOGData(url);
    return response.json({ og });
  }

  /**
   * Bulk amend multiple evidence items with a single amendment payload.
   */
  private async handleBulkAmend(
    gate: ApiGate,
    body: Record<string, unknown>,
    response: Route.Response,
  ) {
    const auth = await gate.checkAuth("mod.evidence.add");
    if (!auth.ok)
      return response.status(403).json({ error: "Forbidden", code: auth.code });

    const { evidenceIds, amendAction, newValue, reason } = body as {
      evidenceIds: string[];
      amendAction: string;
      newValue?: string;
      reason?: string;
    };

    if (
      !evidenceIds ||
      !Array.isArray(evidenceIds) ||
      evidenceIds.length === 0
    ) {
      return response
        .status(400)
        .json({ error: "evidenceIds array is required" });
    }
    if (evidenceIds.length > 25) {
      return response.status(400).json({
        error: "Too many evidence IDs. Maximum 25 items per bulk operation.",
      });
    }
    if (!amendAction) {
      return response.status(400).json({ error: "amendAction is required" });
    }

    const results = [];
    const errors = [];

    for (const evidenceId of evidenceIds) {
      try {
        const amendment = await evidenceService.amendEvidence({
          evidenceId,
          amendedById: gate.userId,
          amendedByTag: gate.member.user.tag,
          action: amendAction,
          newValue,
          reason,
        });
        results.push(amendment);
      } catch (err) {
        errors.push({
          evidenceId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return response.json({ results, errors });
  }
}
