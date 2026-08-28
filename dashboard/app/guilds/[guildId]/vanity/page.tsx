import VanityConfigPage from '@/components/vanity-config-page';

export default async function VanityPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <VanityConfigPage guildId={guildId} />;
}
