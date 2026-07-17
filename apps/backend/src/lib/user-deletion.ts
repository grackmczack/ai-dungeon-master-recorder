import type { Prisma } from "@prisma/client";
import path from "node:path";
import { unlink } from "node:fs/promises";

const STORAGE_ROOT = path.resolve(process.cwd(), "..", "..", "storage");

export interface UserDeletionImpact {
  userId: string;
  displayName: string;
  email: string;
  exclusiveGroups: Array<{ id: string; name: string }>;
  sharedGroups: Array<{ id: string; name: string }>;
  campaigns: number;
  sessions: number;
  activeSessions: number;
  recordings: number;
  memberships: number;
}

export interface UserDeletionPlan extends UserDeletionImpact {
  files: string[];
}

export function isExclusivelyManagedGroup(input: {
  userId: string;
  role: string;
  leftAt: Date | null;
  activeUserIds: Array<string | null>;
}): boolean {
  return (
    input.role === "GM" &&
    input.leftAt === null &&
    !input.activeUserIds.some((otherUserId) => otherUserId !== null && otherUserId !== input.userId)
  );
}

function storageFile(directory: string, value: string | null): string | null {
  if (!value) return null;
  const fileName = path.basename(value);
  if (!fileName || fileName === "." || fileName === "..") return null;
  return path.join(STORAGE_ROOT, directory, fileName);
}

export async function buildUserDeletionPlan(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<UserDeletionPlan | null> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, role: true }
  });
  if (!user || user.role !== "DM") return null;

  const memberships = await tx.groupMembership.findMany({
    where: { userId },
    select: {
      id: true,
      groupId: true,
      role: true,
      leftAt: true,
      avatarUrl: true,
      characterSheetUrl: true,
      group: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: { userId: { not: null }, leftAt: null },
            select: { userId: true }
          }
        }
      }
    }
  });

  const exclusiveGroupIds = new Set(
    memberships
      .filter((membership) =>
        isExclusivelyManagedGroup({
          userId,
          role: membership.role,
          leftAt: membership.leftAt,
          activeUserIds: membership.group.memberships.map((other) => other.userId)
        })
      )
      .map((membership) => membership.groupId)
  );
  const memberGroupIds = new Set(memberships.map((membership) => membership.groupId));
  const sharedGroups = Array.from(memberGroupIds)
    .filter((groupId) => !exclusiveGroupIds.has(groupId))
    .map((groupId) => {
      const group = memberships.find((membership) => membership.groupId === groupId)!.group;
      return { id: group.id, name: group.name };
    });

  const exclusiveGroups = await tx.group.findMany({
    where: { id: { in: Array.from(exclusiveGroupIds) } },
    select: {
      id: true,
      name: true,
      memberships: { select: { avatarUrl: true, characterSheetUrl: true } },
      campaigns: {
        select: {
          backgroundImageUrl: true,
          sessions: {
            select: {
              sessionImageUrl: true,
              status: true,
              recordings: { select: { filePath: true } }
            }
          }
        }
      }
    }
  });

  const files = new Set<string>();
  const addFile = (directory: string, value: string | null) => {
    const file = storageFile(directory, value);
    if (file) files.add(file);
  };

  // Eigene Uploads werden auch aus gemeinsam genutzten Gruppen entfernt.
  for (const membership of memberships) {
    addFile("avatars", membership.avatarUrl);
    addFile("character-sheets", membership.characterSheetUrl);
  }

  let campaigns = 0;
  let sessions = 0;
  let activeSessions = 0;
  let recordings = 0;
  for (const group of exclusiveGroups) {
    for (const membership of group.memberships) {
      addFile("avatars", membership.avatarUrl);
      addFile("character-sheets", membership.characterSheetUrl);
    }
    campaigns += group.campaigns.length;
    for (const campaign of group.campaigns) {
      addFile("campaign-backgrounds", campaign.backgroundImageUrl);
      sessions += campaign.sessions.length;
      for (const session of campaign.sessions) {
        if (session.status !== "DONE" && session.status !== "FAILED") activeSessions += 1;
        addFile("session-images", session.sessionImageUrl);
        recordings += session.recordings.length;
        for (const recording of session.recordings) {
          const recordingFile = storageFile("recordings", recording.filePath);
          if (recordingFile) {
            files.add(recordingFile);
            files.add(recordingFile.replace(/\.(mp3|wav)$/i, ".speakers.json"));
          }
        }
      }
    }
  }

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    exclusiveGroups: exclusiveGroups.map(({ id, name }) => ({ id, name })),
    sharedGroups,
    campaigns,
    sessions,
    activeSessions,
    recordings,
    memberships: memberships.length,
    files: Array.from(files)
  };
}

export async function removeUserFiles(files: string[]): Promise<number> {
  let removed = 0;
  await Promise.all(
    files.map(async (file) => {
      try {
        await unlink(file);
        removed += 1;
      } catch (error: any) {
        if (error?.code !== "ENOENT")
          console.error(`[ADMIN] Datei konnte nicht entfernt werden: ${file}`, error);
      }
    })
  );
  return removed;
}
