export const dynamic = 'force-dynamic';
import { getGuildPageData } from '@/lib/server';
import GuildPageLayout from '@/components/guild-page-layout';
import TextXPConfigPage from '@/components/text-xp-config-page';

export default async function TextXPPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user } = await getGuildPageData(guildId);

  return (
    <GuildPageLayout
      guild={guild}
      user={user}
      activeTab="text-xp"
      pageTitle="Text XP Configuration"
    >
      <TextXPConfigPage guildId={guildId} />
    </GuildPageLayout>
  );
}
