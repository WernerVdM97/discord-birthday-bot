import type { ChatInputCommandInteraction } from "discord.js";
import { vi } from "vitest";

export interface MockInteractionOptions {
  user?: { id: string; displayName: string };
  callerId?: string;
  isAdmin?: boolean;
  date?: string;
  traits?: string;
  guild?: Record<string, unknown> | null;
  /** Role IDs the caller has (for role-gate tests) */
  roleIds?: string[];
}

/**
 * Build a mock ChatInputCommandInteraction for testing command handlers.
 */
export function mockInteraction(
  options: MockInteractionOptions = {}
): ChatInputCommandInteraction {
  const targetUser = options.user ?? { id: "u1", displayName: "TestUser" };

  const mockOptions = {
    getUser: vi.fn().mockReturnValue(targetUser),
    getString: vi.fn((name: string) => {
      if (name === "date") return options.date;
      if (name === "traits") return options.traits;
      return null;
    }),
  };

  const memberPermissions = options.isAdmin
    ? { has: vi.fn().mockReturnValue(true) } as unknown
    : { has: vi.fn().mockReturnValue(false) } as unknown;

  const roleSet = new Set(options.roleIds ?? []);

  return {
    user: { id: options.callerId ?? "caller-1" },
    options: mockOptions,
    memberPermissions,
    member: {
      roles: {
        cache: {
          has: (id: string) => roleSet.has(id),
        },
      },
      permissions: {
        has: (perm: string) => options.isAdmin ?? false,
      },
    },
    guild: options.guild !== undefined ? options.guild : null,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}
