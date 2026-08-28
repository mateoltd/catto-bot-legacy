export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features?: string[];
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  verified?: boolean;
  email?: string;
  locale?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  canSend?: boolean;
}

export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  editable?: boolean;
  managed?: boolean;
}

export interface GuildData {
  channels: Channel[];
  roles: Role[];
}

export interface UserSession {
  user: DiscordUser;
  guilds: Guild[];
}
