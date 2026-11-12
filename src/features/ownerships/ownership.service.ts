import type { ClientSession } from "mongoose";
import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import * as activityService from "@/features/activity/activity.service";
import { OWNERSHIP_MESSAGES } from "@/features/ownerships/ownership.constants";
import type { OwnershipRecord } from "@/features/ownerships/ownership.model";
import * as ownershipRepository from "@/features/ownerships/ownership.repository";
import type { GrantFromOrderResult, OwnedThemeDTO } from "@/features/ownerships/ownership.types";
import { getThemeForAdmin, listThemeSummariesByIds } from "@/features/themes/theme.service";
import { getUserNames } from "@/features/users/user.service";
import { listVersionsForTheme } from "@/features/versions/version.service";

type OrderOwnershipInput = { userId: string; themeId: string; orderId: string };
type AdminGrantInput = { userId: string; themeId: string; note: string | null };
type AdminRevokeInput = { userId: string; themeId: string; note: string };

// The names that the activity summary needs. Throws NOT_FOUND for an unknown theme or customer.
async function getThemeAndCustomerNames(
  themeId: string,
  userId: string,
): Promise<{ themeName: string; customerName: string }> {
  const theme = await getThemeForAdmin(themeId);
  if (!theme) throw new AppError("NOT_FOUND", OWNERSHIP_MESSAGES.themeNotFound);
  const customerName = (await getUserNames([userId])).get(userId);
  if (customerName === undefined) throw new AppError("NOT_FOUND", OWNERSHIP_MESSAGES.customerNotFound);
  return { themeName: theme.name, customerName };
}

// True only when an active ownership exists. The only access rule for downloads (D-016).
export async function hasActiveOwnership(userId: string, themeId: string): Promise<boolean> {
  return ownershipRepository.existsActiveOwnership(userId, themeId);
}

// Gives the theme to the customer after a paid order (docs/03-data-model.md section 8).
// Joins the transaction of the caller when a session is given.
export async function grantFromOrder(
  input: OrderOwnershipInput,
  session?: ClientSession,
): Promise<GrantFromOrderResult> {
  const grant = { source: "purchase", orderId: input.orderId, grantedByUserId: null, grantNote: null } as const;
  const existing = await ownershipRepository.findOwnershipByUserAndTheme(input.userId, input.themeId, session);
  if (!existing) {
    await ownershipRepository.insertOwnership({ ...grant, userId: input.userId, themeId: input.themeId }, session);
    return "created";
  }
  if (existing.status === "active") return "unchanged";
  await ownershipRepository.activateOwnershipById(existing._id.toString(), grant, session);
  return "reactivated";
}

// Takes the theme away after a full refund, only when this order gave it (D-011, D-014).
// Returns true when it revoked.
export async function revokeForRefund(input: OrderOwnershipInput, session?: ClientSession): Promise<boolean> {
  const existing = await ownershipRepository.findOwnershipByUserAndTheme(input.userId, input.themeId, session);
  if (existing?.status !== "active" || existing.orderId?.toString() !== input.orderId) return false;
  return ownershipRepository.revokeOwnershipById(
    existing._id.toString(),
    { revokedAt: now(), revokedReason: "refund", revokedByUserId: null, revokeNote: null },
    session,
  );
}

async function saveAdminGrant(
  existing: OwnershipRecord | null,
  input: AdminGrantInput,
  adminUserId: string,
  summary: string,
): Promise<void> {
  const grant = { source: "admin_grant", orderId: null, grantedByUserId: adminUserId, grantNote: input.note } as const;
  await withTransaction(async (session) => {
    if (existing) {
      await ownershipRepository.activateOwnershipById(existing._id.toString(), grant, session);
    } else {
      await ownershipRepository.insertOwnership({ ...grant, userId: input.userId, themeId: input.themeId }, session);
    }
    await activityService.log(
      {
        action: "ownership_granted",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: input.userId,
        targetType: "theme",
        targetId: input.themeId,
        summary,
      },
      session,
    );
  });
}

// An admin gives a theme to a customer. Refused when the customer already owns it.
export async function grantByAdmin(input: AdminGrantInput, adminUserId: string): Promise<void> {
  const { themeName, customerName } = await getThemeAndCustomerNames(input.themeId, input.userId);
  const existing = await ownershipRepository.findOwnershipByUserAndTheme(input.userId, input.themeId);
  if (existing?.status === "active") throw new AppError("CONFLICT", OWNERSHIP_MESSAGES.alreadyOwned);
  await saveAdminGrant(existing, input, adminUserId, `Theme granted: ${themeName} to ${customerName}`);
}

// An admin takes a theme away from a customer (any ownership, D-122). Refused when the customer does not own it.
export async function revokeByAdmin(input: AdminRevokeInput, adminUserId: string): Promise<void> {
  const { themeName, customerName } = await getThemeAndCustomerNames(input.themeId, input.userId);
  const existing = await ownershipRepository.findOwnershipByUserAndTheme(input.userId, input.themeId);
  if (existing?.status !== "active") throw new AppError("CONFLICT", OWNERSHIP_MESSAGES.notOwned);
  await withTransaction(async (session) => {
    const wasRevoked = await ownershipRepository.revokeOwnershipById(
      existing._id.toString(),
      { revokedAt: now(), revokedReason: "admin", revokedByUserId: adminUserId, revokeNote: input.note },
      session,
    );
    if (!wasRevoked) throw new AppError("CONFLICT", OWNERSHIP_MESSAGES.notOwned);
    await activityService.log(
      {
        action: "ownership_revoked",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: input.userId,
        targetType: "theme",
        targetId: input.themeId,
        summary: `Theme revoked: ${themeName} from ${customerName}`,
      },
      session,
    );
  });
}

// The themes of a customer with their versions (newest first), sorted by theme name. Any theme status.
export async function listOwnedThemes(userId: string): Promise<OwnedThemeDTO[]> {
  const ownerships = await ownershipRepository.findActiveOwnershipsByUserId(userId);
  const themes = await listThemeSummariesByIds(ownerships.map((ownership) => ownership.themeId.toString()));
  const owned = await Promise.all(
    themes.map(async (theme) => ({ theme, versions: await listVersionsForTheme(theme.id) })),
  );
  return owned.sort((first, second) => first.theme.name.localeCompare(second.theme.name, "en"));
}
