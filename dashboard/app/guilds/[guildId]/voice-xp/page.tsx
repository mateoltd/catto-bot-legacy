import VoiceXPConfigPage from '@/components/voice-xp-config-page';

export default async function VoiceXPPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <VoiceXPConfigPage guildId={guildId} />;
}
