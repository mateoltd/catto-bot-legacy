export const dynamic = 'force-dynamic';
import { getGuildPageData } from '@/lib/server';
import GuildPageLayout from '@/components/guild-page-layout';
import RewardsConfigForm from '@/components/rewards-config-form';

export default async function RewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user } = await getGuildPageData(guildId);

  return (
    <GuildPageLayout guild={guild} user={user} activeTab="rewards" pageTitle="Level Rewards">
      <RewardsConfigForm guildId={guildId} />
    </GuildPageLayout>
  );
}
