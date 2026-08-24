import RewardsConfigForm from '@/components/rewards-config-form';

export default async function RewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <RewardsConfigForm guildId={guildId} />;
}
