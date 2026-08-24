import LoggingConfigForm from '@/components/logging-config-form';

export default async function LogsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <LoggingConfigForm guildId={guildId} />;
}
