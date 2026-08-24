import TextXPConfigPage from '@/components/text-xp-config-page';

export default async function TextXPPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <TextXPConfigPage guildId={guildId} />;
}
