export type AccountAccessState = "ACTIVE" | "INACTIVE" | "EMAIL_NOT_VERIFIED" | "APPROVAL_PENDING";

type AccountAccessInput = {
  role: "SUPER_ADMIN" | "DM";
  isActive: boolean;
  emailVerifiedAt: Date | null;
  approvedAt: Date | null;
} | null;

export function accountAccessState(user: AccountAccessInput): AccountAccessState {
  if (!user?.isActive) return "INACTIVE";
  if (!user.emailVerifiedAt) return "EMAIL_NOT_VERIFIED";
  if (user.role !== "SUPER_ADMIN" && !user.approvedAt) return "APPROVAL_PENDING";
  return "ACTIVE";
}
