import type { Prisma } from "@prisma/client";
import { accountAccessState } from "./account-access.js";

export type DiscordInstallationAccessStatus =
  | "READY"
  | "UNCLAIMED"
  | "EMAIL_PENDING"
  | "APPROVAL_PENDING"
  | "ACCOUNT_BLOCKED";

type InstallationMembership = {
  role: "GM" | "PLAYER" | "OBSERVER";
  leftAt: Date | null;
  user: {
    role: "SUPER_ADMIN" | "DM";
    isActive: boolean;
    emailVerifiedAt: Date | null;
    approvedAt: Date | null;
  } | null;
};

export const authorizedGmMembershipWhere = {
  role: "GM",
  leftAt: null,
  user: {
    is: {
      isActive: true,
      emailVerifiedAt: { not: null },
      OR: [{ role: "SUPER_ADMIN" }, { approvedAt: { not: null } }]
    }
  }
} satisfies Prisma.CampaignMembershipWhereInput;

export function discordInstallationAccessStatus(
  memberships: InstallationMembership[]
): DiscordInstallationAccessStatus {
  const accountStates = memberships
    .filter((membership) => membership.role === "GM" && !membership.leftAt && membership.user)
    .map((membership) => accountAccessState(membership.user));

  if (accountStates.length === 0) return "UNCLAIMED";
  if (accountStates.includes("ACTIVE")) return "READY";
  if (accountStates.includes("APPROVAL_PENDING")) return "APPROVAL_PENDING";
  if (accountStates.includes("EMAIL_NOT_VERIFIED")) return "EMAIL_PENDING";
  return "ACCOUNT_BLOCKED";
}
