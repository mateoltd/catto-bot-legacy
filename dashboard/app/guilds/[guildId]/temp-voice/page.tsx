import TempVoiceConfigForm from '@/components/temp-voice-config-form';

export default async function TempVoicePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <TempVoiceConfigForm guildId={guildId} />;
}
