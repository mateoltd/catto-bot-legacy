import { LogoutButton } from './logout-button';
import Image from 'next/image';
import type { DiscordUser } from '@/lib/types';

export function WelcomeMessage({ user }: { user: DiscordUser }) {
  // Construct Discord avatar URL
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;

  const displayName = `${user.username}#${user.discriminator}`;

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border animate-slide-up">
      {/* User Profile */}
      <div className="flex items-center gap-4">
        <div className="relative w-12 h-12 rounded-full overflow-hidden">
          <Image
            src={avatarUrl}
            alt={user.username}
            fill
            className="object-cover"
            sizes="48px"
            priority
          />
        </div>
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium text-lg">{user.username}</h3>
            {user.verified && (
              <svg
                viewBox="0 0 24 24"
                aria-label="Verified account"
                className="w-5 h-5 text-blue-500 fill-blue-500"
              >
                <g>
                  <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"></path>
                </g>
              </svg>
            )}
          </div>
          <p className="text-sm text-gray-500">{displayName}</p>
        </div>
      </div>

      <div className="mt-6 mb-4">
        <h2 className="text-base font-medium text-gray-600">
          Welcome back, <span className="font-semibold">{user.username}</span>
        </h2>
      </div>

      <div className="flex justify-start">
        <LogoutButton />
      </div>
    </div>
  );
}
