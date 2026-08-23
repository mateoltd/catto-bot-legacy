import { container } from '@sapphire/framework';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import { storageService } from '#lib/storage/StorageService.js';
import { generateExportReport } from '../templates/export-report.js';
import type { ExportReportData } from '../templates/export-report.js';

const MAX_EVIDENCE_ITEMS = 100;

export class ExportService {
  /**
   * Export a case with all evidence as a ZIP archive.
   * Returns a presigned download URL (1hr expiry).
   */
  async exportCase(
    guildId: string,
    caseNumber: number,
    _exportedById: string,
    exportedByTag: string
  ): Promise<{ downloadUrl: string }> {
    // 1. Fetch case
    const modCase = await container.prisma.modCase.findFirst({
      where: { guildId, caseNumber },
    });
    if (!modCase) throw new Error(`Case #${caseNumber} not found`);

    // 2. Fetch evidence (capped)
    const evidenceItems = await container.prisma.evidence.findMany({
      where: { guildId, caseNumber },
      orderBy: { createdAt: 'asc' },
      take: MAX_EVIDENCE_ITEMS,
      include: { amendments: { orderBy: { createdAt: 'asc' } } },
    });

    // 3. Build temp directory
    const exportId = randomUUID();
    const tempDir = join(tmpdir(), `case-export-${exportId}`);
    const evidenceDir = join(tempDir, 'evidence');
    await mkdir(evidenceDir, { recursive: true });

    const zipPath = join(tempDir, `case_${caseNumber}.zip`);

    try {
      // 4. Download evidence files from storage
      const reportEvidence: ExportReportData['evidence'] = [];

      for (const item of evidenceItems) {
        let localFilename: string | null = null;

        if (item.storageKey && storageService.isConfigured) {
          try {
            const safeFilename = `${item.id}_${item.originalFilename ?? 'file'}`.replace(
              /[^a-zA-Z0-9._-]/g,
              '_'
            );
            const destPath = join(evidenceDir, safeFilename);
            await storageService.downloadFile(item.storageKey, destPath);
            localFilename = safeFilename;
          } catch (err) {
            container.logger.warn(`Export: failed to download evidence ${item.id}:`, err);
          }
        }

        reportEvidence.push({
          id: item.id,
          type: item.type,
          status: item.status,
          originalFilename: item.originalFilename,
          url: item.url,
          description: item.description,
          uploadedByTag: item.uploadedByTag,
          createdAt: item.createdAt.toISOString(),
          sizeBytes: item.sizeBytes,
          contentHash: item.contentHash,
          tags: item.tags ?? [],
          localFilename,
          amendments: (item.amendments ?? []).map((a) => ({
            action: a.action,
            amendedByTag: a.amendedByTag,
            reason: a.reason,
            newValue: a.newValue,
            createdAt: a.createdAt.toISOString(),
          })),
        });
      }

      // 5. Generate HTML report
      const reportData: ExportReportData = {
        modCase: {
          caseNumber: modCase.caseNumber,
          guildId: modCase.guildId,
          action: modCase.action,
          targetTag: modCase.targetTag,
          targetId: modCase.targetId,
          moderatorTag: modCase.moderatorTag,
          moderatorId: modCase.moderatorId,
          reason: modCase.reason,
          status: modCase.status,
          createdAt: modCase.createdAt.toISOString(),
          duration: modCase.duration,
        },
        evidence: reportEvidence,
        exportedAt: new Date().toISOString(),
        exportedBy: exportedByTag,
      };

      const reportHtml = generateExportReport(reportData);

      // 6. Generate metadata.json
      const metadata = {
        caseNumber: modCase.caseNumber,
        guildId: modCase.guildId,
        exportedAt: reportData.exportedAt,
        exportedBy: exportedByTag,
        evidenceCount: evidenceItems.length,
        evidenceIds: evidenceItems.map((e) => e.id),
      };

      // 7. Create ZIP
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 6 } });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);
        archive.append(reportHtml, { name: 'report.html' });
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Add evidence files
        for (const item of reportEvidence) {
          if (item.localFilename) {
            archive.file(join(evidenceDir, item.localFilename), {
              name: `evidence/${item.localFilename}`,
            });
          }
        }

        archive.finalize();
      });

      // 8. Upload ZIP to B2
      if (!storageService.isConfigured) {
        throw new Error('Storage is not configured — cannot upload export');
      }

      const storageKey = `exports/${guildId}/case_${caseNumber}_${exportId}.zip`;
      const zipStream = createReadStream(zipPath);
      await storageService.uploadStream(storageKey, zipStream, 'application/zip');

      // 9. Generate presigned download URL (1 hour)
      const downloadUrl = await storageService.generateDownloadUrl(
        storageKey,
        `case_${caseNumber}_export.zip`,
        3600
      );

      return { downloadUrl };
    } finally {
      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export const exportService = new ExportService();
