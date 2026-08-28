import { container } from '@sapphire/framework';
import { Queue, Worker, type Job } from 'bullmq';
import { Routes, type RESTGetAPIGuildMembersResult } from 'discord-api-types/v10';
import { URLSearchParams } from 'node:url';
import { CONFIG } from '#config.js';
import { getVanityConfig } from './config.service.js';

const QUEUE_NAME = 'vanity-role-cleanup';
const LATEST_JOB_TTL_SECONDS = 7 * 24 * 60 * 60;

function latestJobKey(guildId: string): string {
  return `vanity:cleanup:latest:${guildId}`;
}

export interface VanityCleanupJobData {
  guildId: string;
  roleId: string;
  requestedById: string;
}

export interface VanityCleanupProgress {
  processed: number;
  removed: number;
  failed: number;
  total: number;
}

export interface VanityCleanupStatus extends VanityCleanupProgress {
  id: string;
  guildId: string;
  roleId: string;
  state: string;
  failureReason: string | null;
}

export class VanityCleanupService {
  private queue: Queue<VanityCleanupJobData> | null = null;
  private worker: Worker<VanityCleanupJobData, VanityCleanupProgress> | null = null;

  async initialize(): Promise<void> {
    if (this.queue || this.worker) return;

    const connection = {
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
    };

    this.queue = new Queue<VanityCleanupJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 500 },
      },
    });

    this.worker = new Worker<VanityCleanupJobData, VanityCleanupProgress>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, error) => {
      container.logger.error(`[Vanity cleanup] Job ${job?.id ?? 'unknown'} failed:`, error);
    });
    this.worker.on('error', (error) => {
      container.logger.error('[Vanity cleanup] Worker error:', error);
    });

    container.logger.info('[Vanity cleanup] Worker initialized');
  }

  async schedule(guildId: string, roleId: string, requestedById: string): Promise<string> {
    if (!this.queue) throw new Error('Vanity cleanup worker is not initialized');

    const jobId = `vanity-cleanup-${guildId}-${roleId}-${Date.now()}`;
    const key = latestJobKey(guildId);
    await container.redis.setex(key, LATEST_JOB_TTL_SECONDS, jobId);

    try {
      const job = await this.queue.add(
        'remove-role-assignments',
        { guildId, roleId, requestedById },
        { jobId },
      );
      if (!job.id) throw new Error('Vanity cleanup job did not receive an ID');
      return job.id;
    } catch (error) {
      if ((await container.redis.get(key)) === jobId) await container.redis.del(key);
      throw error;
    }
  }

  async getLatestStatus(guildId: string): Promise<VanityCleanupStatus | null> {
    const jobId = await container.redis.get(latestJobKey(guildId));
    return jobId ? this.getStatus(jobId) : null;
  }

  async hasActiveCleanup(guildId: string): Promise<boolean> {
    const status = await this.getLatestStatus(guildId);
    return Boolean(
      status && ['waiting', 'active', 'delayed', 'prioritized'].includes(status.state),
    );
  }

  async getStatus(jobId: string): Promise<VanityCleanupStatus | null> {
    if (!this.queue) return null;
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress =
      typeof job.progress === 'object' && job.progress
        ? (job.progress as Partial<VanityCleanupProgress>)
        : {};
    const result = job.returnvalue ?? undefined;

    return {
      id: job.id ?? jobId,
      guildId: job.data.guildId,
      roleId: job.data.roleId,
      state,
      processed: result?.processed ?? progress.processed ?? 0,
      removed: result?.removed ?? progress.removed ?? 0,
      failed: result?.failed ?? progress.failed ?? 0,
      total: result?.total ?? progress.total ?? 0,
      failureReason: job.failedReason ?? null,
    };
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }

  private async process(job: Job<VanityCleanupJobData>): Promise<VanityCleanupProgress> {
    const { guildId, roleId, requestedById } = job.data;
    const guild = container.client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} is not available`);

    const config = await getVanityConfig(guildId, true);
    if (config?.enabled && config.roleId === roleId) {
      throw new Error('Refusing to clean a role while it is actively managed');
    }

    const progress: VanityCleanupProgress = {
      processed: 0,
      removed: 0,
      failed: 0,
      total: guild.memberCount,
    };
    let after = '0';

    while (true) {
      const page = (await container.client.rest.get(Routes.guildMembers(guildId), {
        query: new URLSearchParams({ limit: '1000', after }),
      })) as RESTGetAPIGuildMembersResult;
      if (page.length === 0) break;

      const targets = page.filter((member) => member.roles.includes(roleId));
      let cursor = 0;
      const workerCount = Math.min(5, targets.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (cursor < targets.length) {
            const member = targets[cursor++];
            const memberId = member?.user?.id;
            if (!memberId) continue;
            try {
              await container.client.rest.delete(
                Routes.guildMemberRole(guildId, memberId, roleId),
                { reason: `Vanity role cleanup requested by ${requestedById}` },
              );
              progress.removed++;
            } catch (error) {
              progress.failed++;
              container.logger.warn(
                `[Vanity cleanup] Failed to remove role ${roleId} from ${memberId}:`,
                error,
              );
            }
          }
        }),
      );

      progress.processed += page.length;
      await job.updateProgress(progress);
      after = page[page.length - 1]?.user?.id ?? after;
      if (page.length < 1000) break;
    }

    if (progress.failed > 0) {
      throw new Error(`Failed to remove ${progress.failed} role assignment(s)`);
    }

    return progress;
  }
}

export const vanityCleanupService = new VanityCleanupService();
