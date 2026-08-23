export const dynamic = 'force-dynamic';
import { getGuildPageData } from '@/lib/server';
import GuildPageLayout from '@/components/guild-page-layout';
import VoiceXPConfigPage from '@/components/voice-xp-config-page';

export default async function VoiceXPPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user } = await getGuildPageData(guildId);

  return (
    <GuildPageLayout
      guild={guild}
      user={user}
      activeTab="voice-xp"
      pageTitle="Voice XP Configuration"
    >
      <VoiceXPConfigPage guildId={guildId} />
    </GuildPageLayout>
  );
}
