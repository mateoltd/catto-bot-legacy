import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL environment variable is not set. Cannot initialize Prisma adapter for seeding.'
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  const exampleGuild = await prisma.guild.upsert({
    where: { guildId: '998351254998753402' },
    update: {},
    create: {
      guildId: '998351254998753402',
      name: 'Example Guild',
      settings: {
        prefix: '!',
        language: 'en',
      },
    },
  });

  console.log('Created example guild:', exampleGuild);
  console.log('Database seeding completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
