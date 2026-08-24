import GuildPageLayout from '@/components/guild-page-layout';
import { getGuildOverviewPageData } from '@/lib/server';

export default async function GuildLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}>) {
  const { guildId } = await params;
  const { guild, user, access } = await getGuildOverviewPageData(guildId);

  return (
    <GuildPageLayout guild={guild} user={user} access={access}>
      {children}
    </GuildPageLayout>
  );
}
