import { GuildOverview } from '@/components/dashboard/guild-overview';

export default async function GuildPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <GuildOverview guildId={guildId} />;
}
