/**
 * One-time migration script: ModCase.evidence (JSON) → Evidence table rows.
 *
 * Parses the legacy `evidence` JSON field on ModCase records and creates
 * corresponding Evidence rows in the new table. Safe to run multiple times —
 * it skips cases that already have Evidence rows.
 *
 * Usage:
 *   npx tsx prisma/migrations/migrate-evidence-json.ts
 */

import { PrismaClient, EvidenceType, EvidenceStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DISCORD_URL_RE = /^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/\d+\/\d+/;

interface LegacyEvidence {
  messageLinks?: string[];
  attachments?: string[];
  notes?: string[];
}

async function main() {
  console.log('Starting evidence migration...');

  // Find all cases with non-null JSON evidence and no new Evidence rows yet
  const cases = await prisma.modCase.findMany({
    where: {
      evidence: { not: null },
      evidenceItems: { none: {} },
    },
    select: {
      id: true,
      caseNumber: true,
      guildId: true,
      moderatorId: true,
      moderatorTag: true,
      evidence: true,
    },
  });

  console.log(`Found ${cases.length} case(s) with legacy JSON evidence to migrate.`);

  let created = 0;
  let skipped = 0;

  for (const modCase of cases) {
    const raw = modCase.evidence as LegacyEvidence | null;
    if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
      skipped++;
      continue;
    }

    const evidenceToCreate: Array<{
      guildId: string;
      caseId: string;
      caseNumber: number;
      uploadedById: string;
      uploadedByTag: string;
      type: EvidenceType;
      status: EvidenceStatus;
      url?: string;
      description?: string;
    }> = [];

    // Migrate message links
    if (raw.messageLinks && Array.isArray(raw.messageLinks)) {
      for (const link of raw.messageLinks) {
        if (typeof link !== 'string') continue;
        const isDiscord = DISCORD_URL_RE.test(link);
        evidenceToCreate.push({
          guildId: modCase.guildId,
          caseId: modCase.id,
          caseNumber: modCase.caseNumber,
          uploadedById: modCase.moderatorId,
          uploadedByTag: modCase.moderatorTag,
          type: isDiscord ? EvidenceType.DISCORD_URL : EvidenceType.URL,
          status: EvidenceStatus.VERIFIED,
          url: link,
          description: 'Migrated from legacy evidence JSON',
        });
      }
    }

    // Migrate attachments (URLs)
    if (raw.attachments && Array.isArray(raw.attachments)) {
      for (const att of raw.attachments) {
        if (typeof att !== 'string') continue;
        evidenceToCreate.push({
          guildId: modCase.guildId,
          caseId: modCase.id,
          caseNumber: modCase.caseNumber,
          uploadedById: modCase.moderatorId,
          uploadedByTag: modCase.moderatorTag,
          type: EvidenceType.URL,
          status: EvidenceStatus.VERIFIED,
          url: att,
          description: 'Migrated attachment from legacy evidence JSON',
        });
      }
    }

    // Migrate notes as amendments (not evidence items)
    // Notes get stored as EvidenceAmendment on the first evidence item
    const noteTexts = raw.notes?.filter((n): n is string => typeof n === 'string') ?? [];

    if (evidenceToCreate.length === 0 && noteTexts.length === 0) {
      skipped++;
      continue;
    }

    // If there are only notes but no evidence items, create a placeholder URL evidence
    if (evidenceToCreate.length === 0 && noteTexts.length > 0) {
      evidenceToCreate.push({
        guildId: modCase.guildId,
        caseId: modCase.id,
        caseNumber: modCase.caseNumber,
        uploadedById: modCase.moderatorId,
        uploadedByTag: modCase.moderatorTag,
        type: EvidenceType.URL,
        status: EvidenceStatus.VERIFIED,
        description: `Migrated notes: ${noteTexts.join(' | ')}`,
      });
    }

    // Create evidence rows in a transaction
    await prisma.$transaction(async (tx) => {
      const createdItems = [];
      for (const data of evidenceToCreate) {
        const item = await tx.evidence.create({ data });
        createdItems.push(item);
        created++;
      }

      // Attach notes as amendments to the first evidence item
      if (noteTexts.length > 0 && createdItems.length > 0) {
        for (const note of noteTexts) {
          await tx.evidenceAmendment.create({
            data: {
              evidenceId: createdItems[0].id,
              amendedById: modCase.moderatorId,
              amendedByTag: modCase.moderatorTag,
              action: 'NOTE_ADDED',
              newValue: note,
              reason: 'Migrated from legacy evidence JSON',
            },
          });
        }
      }
    });
  }

  console.log(`Migration complete. Created ${created} evidence row(s), skipped ${skipped} case(s).`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
