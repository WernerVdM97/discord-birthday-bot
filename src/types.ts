export interface Birthday {
  userId: string;
  username: string;
  birthday: string; // 'MM-DD'
  locked: boolean;
  traitEmoji: string;
  updatedAt: string; // ISO timestamp
}

export interface Trait {
  userId: string;
  trait: string;
  source: "scraped" | "manual";
}

export interface WishCache {
  userId: string;
  wish: string;
  year: number;
  generatedAt: string; // ISO timestamp
}

export interface DiscordConfig {
  token: string;
  appId: string;
  guildId: string;
  announcementsChannelId: string;
  botAdminId?: string;
  adminRoleId?: string;
  memberRoleId?: string;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
