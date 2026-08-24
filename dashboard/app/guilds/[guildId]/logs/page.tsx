export const dynamic = 'force-dynamic';
import { getGuildPageData } from '@/lib/server';
import GuildPageLayout from '@/components/guild-page-layout';
import LoggingConfigForm from '@/components/logging-config-form';

export default async function LogsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user, access } = await getGuildPageData(guildId);

  return (
    <GuildPageLayout
      guild={guild}
      user={user}
      access={access}
      activeTab="logs"
      pageTitle="Event Logging"
    >
      <LoggingConfigForm guildId={guildId} />
    </GuildPageLayout>
  );
}
