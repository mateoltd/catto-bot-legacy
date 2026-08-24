import { AccountMenu } from '@/components/dashboard/account-menu';
import type { DiscordUser } from '@/lib/types';

export function UserDropdown({ user }: { user: DiscordUser }) {
  return <AccountMenu user={user} showModerationLink allowAccountSwitch />;
}
