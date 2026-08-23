export const dynamic = 'force-dynamic';
import { getGuildPageData } from '@/lib/server';
import GuildPageLayout from '@/components/guild-page-layout';
import TempVoiceConfigForm from '@/components/temp-voice-config-form';

export default async function TempVoicePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user } = await getGuildPageData(guildId);

  return (
    <GuildPageLayout
      guild={guild}
      user={user}
      activeTab="temp-voice"
      pageTitle="Temp Voice Channels"
    >
      <TempVoiceConfigForm guildId={guildId} />
    </GuildPageLayout>
  );
}
