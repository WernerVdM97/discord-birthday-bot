import type {
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { getDiscordConfig } from "./config.js";

function getAdminRoleId(): string | undefined {
  return process.env["BOT_ADMIN_ROLE_ID"] || undefined;
}

function getMemberRoleId(): string | undefined {
  return process.env["BOT_MEMBER_ROLE_ID"] || undefined;
}

export function isBotAdmin(callerId: string): boolean {
  return callerId === (process.env["BOT_ADMIN_ID"] || undefined);
}

export function hasAdminRole(member: GuildMember | null): boolean {
  if (!member) return false;
  const adminRoleId = getAdminRoleId();
  if (!adminRoleId) return false;
  return member.roles.cache.has(adminRoleId);
}

export function hasMemberRole(member: GuildMember | null): boolean {
  if (!member) return false;
  const memberRoleId = getMemberRoleId();
  if (!memberRoleId) return false;
  const adminRoleId = getAdminRoleId();
  // Admins are also members
  if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;
  return member.roles.cache.has(memberRoleId);
}

export function hasServerAdminPerm(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has("Administrator");
}

/**
 * True if the caller is allowed to perform admin-level actions
 * (override locks, set birthdays for anyone, use /missing, etc.).
 */
export function isPrivileged(
  interaction: ChatInputCommandInteraction
): boolean {
  const member = interaction.member as GuildMember | null;
  return (
    isBotAdmin(interaction.user.id) ||
    hasServerAdminPerm(member) ||
    hasAdminRole(member)
  );
}

/**
 * True if the caller is at least a member (can set traits, set own birthday).
 * Privileged users are also members.
 */
export function isMemberOrAbove(
  interaction: ChatInputCommandInteraction
): boolean {
  if (isPrivileged(interaction)) return true;
  const member = interaction.member as GuildMember | null;
  return hasMemberRole(member);
}

/**
 * Check if role-based access is configured.
 * If no roles are set, return false (open access for backwards compat).
 */
export function isRoleGateActive(): boolean {
  return !!(getAdminRoleId() || getMemberRoleId());
}
