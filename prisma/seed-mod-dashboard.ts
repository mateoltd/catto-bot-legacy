/**
 * Seed script for mod dashboard development testing.
 *
 * Seeds guild 1462093013655228491 with moderator 216746923070062593
 * Creates ~150 cases spread across 90 days with varied actions,
 * plus evidence items and amendments for testing graphs and UI.
 *
 * Usage:  tsx prisma/seed-mod-dashboard.ts
 * Requires: DATABASE_URL env var (reads from .env automatically)
 * 
 * This will be removed once the mod dashboard is fully functional and added to standard seeding.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ModAction, CaseStatus, EvidenceType, EvidenceStatus } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

if (
  process.env.NODE_ENV === 'production' ||
  databaseUrl.includes('prod') ||
  databaseUrl.includes('production')
) {
  throw new Error(
    'SAFETY: This seed script must not run in production. ' +
    'DATABASE_URL appears to point to a production database.'
  );
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// ── Constants ──

const GUILD_ID = '932630671581675562';
const MODERATOR_ID = '216746923070062593';
const MODERATOR_TAG = 'matheo';

// A second moderator for variety
const MOD2_ID = '505402639140519938';
const MOD2_TAG = 'joshiny';

const TARGET_USERS = [
  { id: '720315700320927796', tag: '_whostao_' },
  { id: '293504726505357312', tag: 'ellian.' },
  { id: '1413916652873060423', tag: 'toxic_user' },
  { id: '871173928003985458', tag: 'paul10104' },
  { id: '1401268429490749500', tag: '_snnay_' },
  { id: '144637413015289856', tag: 'ecx2f' },
  { id: '531626979376627728', tag: 's2shizuku' },
  { id: '820530029640286229', tag: 'michivellee' },
  { id: '1367515678155870218', tag: 'kai_06.9374' },
  { id: '1358650521505890435', tag: 'lily_satoru' },
  { id: '991015778167980133', tag: 'afkjust' },
  { id: '1304193671603818528', tag: '1a.bell' },
];

const ACTIONS: ModAction[] = [
  'WARN', 'WARN', 'WARN', 'WARN',    // weighted towards warns
  'TIMEOUT', 'TIMEOUT', 'TIMEOUT',
  'BAN', 'BAN',
  'KICK', 'KICK',
  'MUTE_TEXT',
  'MUTE_VOICE',
  'MUTE_BOTH',
  'SOFTBAN',
  'TEMPBAN',
  'UNBAN',
];

const REASONS: Record<string, string[]> = {
  WARN: [
    'Inappropriate language in #general',
    'Spam in voice chat',
    'Advertising without permission',
    'Disrespecting staff members',
    'Off-topic posting in moderation channels',
    'Excessive caps usage',
    'Minor rule violation',
  ],
  TIMEOUT: [
    'Repeated warnings ignored — 1h timeout',
    'Heated argument, cooling off period',
    'Spam after verbal warning — 30m timeout',
    'Disruptive behavior in VC — 2h timeout',
  ],
  BAN: [
    'Severe harassment of multiple members',
    'Doxxing attempt',
    'NSFW content in SFW channels (3rd offense)',
    'Raid participant',
    'Scam links posted repeatedly',
  ],
  KICK: [
    'Joined to advertise, refusing to stop',
    'Compromised account — kicked for safety',
    'Underage account (will rejoin when eligible)',
  ],
  MUTE_TEXT: [
    'Text muted for ongoing spam',
    'Muted pending investigation',
  ],
  SOFTBAN: [
    'Message cleanup — softban for raid content',
  ],
  TEMPBAN: [
    'Temporary ban: 7 days for repeated toxicity',
    'Temp ban: 3 days — appeal via ModMail',
  ],
  UNBAN: [
    'Appeal approved — user may rejoin',
    'Ban was mistaken identity',
  ],
};

const EVIDENCE_DESCRIPTIONS = [
  'Screenshot of rule-breaking message',
  'Recording of toxic voice chat behavior',
  'Log of spam messages before deletion',
  'DM evidence provided by victim',
  'Screenshot of scam link posted in #general',
  'AutoMod flagged content',
  'Report submission from another member',
];

const AMENDMENT_NOTES = [
  'Added additional context from #mod-chat discussion',
  'Victim provided more screenshots',
  'Updated after reviewing logs',
  'Escalated to admin review',
  'Case reviewed in weekly mod meeting',
  'Cross-referenced with previous case',
];

// ── Helpers ──

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const now = Date.now();
  const offset = Math.random() * daysAgo * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function cuid(): string {
  // Simple pseudo-cuid for seeding
  return 'seed_' + randomBytes(12).toString('hex');
}

// ── Main ──

async function main() {
  console.log('🌱 Mod Dashboard Seed Script');
  console.log('   Guild:', GUILD_ID);
  console.log('   Moderator:', MODERATOR_ID);
  console.log('');

  // 1. Ensure guild exists
  await prisma.guild.upsert({
    where: { guildId: GUILD_ID },
    update: {},
    create: {
      guildId: GUILD_ID,
      name: 'Seed Test Server',
      settings: { prefix: '!', language: 'en' },
    },
  });
  console.log('✓ Guild ensured');

  // 2. Find highest existing case number
  const lastCase = await prisma.modCase.findFirst({
    where: { guildId: GUILD_ID },
    orderBy: { caseNumber: 'desc' },
  });
  let caseCounter = (lastCase?.caseNumber ?? 0) + 1;
  console.log(`  Starting case numbers at #${caseCounter}`);

  // 3. Generate cases
  const TOTAL_CASES = 150;
  const casesToCreate: {
    id: string;
    caseNumber: number;
    action: ModAction;
    targetId: string;
    targetTag: string;
    moderatorId: string;
    moderatorTag: string;
    reason: string;
    status: CaseStatus;
    duration: number | null;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < TOTAL_CASES; i++) {
    const action = randomItem(ACTIONS);
    const target = randomItem(TARGET_USERS);
    const isMod1 = Math.random() < 0.7; // 70% by primary moderator
    const reasons = REASONS[action] || REASONS['WARN'];
    const createdAt = randomDate(90);

    let status: CaseStatus = 'CLOSED';
    if (Math.random() < 0.15) status = 'OPEN';
    if (Math.random() < 0.05) status = 'VOID';

    let duration: number | null = null;
    if (action === 'TIMEOUT') duration = randomItem([1800, 3600, 7200, 86400]);
    if (action === 'TEMPBAN') duration = randomItem([86400, 259200, 604800]);

    casesToCreate.push({
      id: cuid(),
      caseNumber: caseCounter++,
      action,
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: isMod1 ? MODERATOR_ID : MOD2_ID,
      moderatorTag: isMod1 ? MODERATOR_TAG : MOD2_TAG,
      reason: randomItem(reasons),
      status,
      duration,
      createdAt,
    });
  }

  // Sort by createdAt so case numbers are chronological
  casesToCreate.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // Reassign case numbers in chronological order
  let num = (lastCase?.caseNumber ?? 0) + 1;
  for (const c of casesToCreate) {
    c.caseNumber = num++;
  }

  // Batch insert cases
  for (const c of casesToCreate) {
    await prisma.modCase.create({
      data: {
        id: c.id,
        caseNumber: c.caseNumber,
        guildId: GUILD_ID,
        action: c.action,
        targetId: c.targetId,
        targetTag: c.targetTag,
        moderatorId: c.moderatorId,
        moderatorTag: c.moderatorTag,
        reason: c.reason,
        status: c.status,
        duration: c.duration,
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
      },
    });
  }
  console.log(`✓ Created ${TOTAL_CASES} cases`);

  // 4. Add evidence to ~40% of cases
  let evidenceCount = 0;
  const evidenceCases = casesToCreate.filter(() => Math.random() < 0.4);

  for (const c of evidenceCases) {
    const itemCount = Math.random() < 0.3 ? 2 : 1; // 30% chance of 2 items

    for (let e = 0; e < itemCount; e++) {
      const evidenceType = randomItem<EvidenceType>(['IMAGE', 'IMAGE', 'URL', 'DOCUMENT', 'DISCORD_URL']);
      const evidenceId = cuid();
      const isFileType = evidenceType === 'IMAGE' || evidenceType === 'DOCUMENT';

      await prisma.evidence.create({
        data: {
          id: evidenceId,
          guildId: GUILD_ID,
          caseId: c.id,
          caseNumber: c.caseNumber,
          uploadedById: c.moderatorId,
          uploadedByTag: c.moderatorTag,
          type: evidenceType,
          status: randomItem<EvidenceStatus>(['VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING', 'FLAGGED']),
          storageKey: isFileType ? `${GUILD_ID}/${c.caseNumber}/${evidenceId}/evidence.${evidenceType === 'IMAGE' ? 'png' : 'pdf'}` : null,
          storageBucket: isFileType ? 'catto-evidence-dev' : null,
          originalFilename: isFileType ? `evidence_${c.caseNumber}_${e + 1}.${evidenceType === 'IMAGE' ? 'png' : 'pdf'}` : null,
          mimeType: evidenceType === 'IMAGE' ? 'image/png' : evidenceType === 'DOCUMENT' ? 'application/pdf' : null,
          sizeBytes: isFileType ? Math.floor(Math.random() * 5000000) + 10000 : null,
          contentHash: isFileType ? sha256(`${evidenceId}-content`) : null,
          url: !isFileType ? `https://example.com/evidence/${evidenceId}` : null,
          description: randomItem(EVIDENCE_DESCRIPTIONS),
          createdAt: new Date(c.createdAt.getTime() + 60000), // 1 minute after case
          updatedAt: new Date(c.createdAt.getTime() + 60000),
        },
      });
      evidenceCount++;

      // Add amendments to ~30% of evidence
      if (Math.random() < 0.3) {
        const amendCount = Math.random() < 0.5 ? 1 : 2;
        for (let a = 0; a < amendCount; a++) {
          await prisma.evidenceAmendment.create({
            data: {
              id: cuid(),
              evidenceId,
              amendedById: Math.random() < 0.5 ? MODERATOR_ID : MOD2_ID,
              amendedByTag: Math.random() < 0.5 ? MODERATOR_TAG : MOD2_TAG,
              action: randomItem(['NOTE_ADDED', 'NOTE_ADDED', 'DESCRIPTION_UPDATED', 'FLAGGED']),
              reason: randomItem(AMENDMENT_NOTES),
              createdAt: new Date(c.createdAt.getTime() + (a + 1) * 3600000), // hours after
            },
          });
        }
      }
    }
  }
  console.log(`✓ Created ${evidenceCount} evidence items with amendments`);

  // 5. Summary
  console.log('');
  console.log('Seed complete! Summary:');
  console.log(`  Cases: ${TOTAL_CASES}`);
  console.log(`  Evidence items: ${evidenceCount}`);
  console.log(`  Date range: last 90 days`);
  console.log(`  Primary mod (70%): ${MODERATOR_TAG} (${MODERATOR_ID})`);
  console.log(`  Secondary mod (30%): ${MOD2_TAG} (${MOD2_ID})`);
  console.log('');
  console.log('Run the dashboard with `pnpm dev` and navigate to /mod to see the data.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
