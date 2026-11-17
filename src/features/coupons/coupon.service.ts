import type { ClientSession } from "mongoose";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import * as activityService from "@/features/activity/activity.service";
import { COUPON_MESSAGES, MIN_FINAL_PRICE_CENTS } from "@/features/coupons/coupon.constants";
import { toCouponAdminDTO, toCouponListItemDTO } from "@/features/coupons/coupon.mapper";
import type { CouponRecord } from "@/features/coupons/coupon.model";
import * as couponRepository from "@/features/coupons/coupon.repository";
import type { CouponInput, CouponUpdateInput } from "@/features/coupons/coupon.schemas";
import type { CouponAdminDTO, CouponListItemDTO, CouponQuote } from "@/features/coupons/coupon.types";
import { deleteCouponDiscount, syncCouponDiscount } from "@/features/payments/payment-sync.service";
import { getThemesProviderInfo } from "@/features/themes/theme.service";

type QuoteInput = { themeId: string; priceCents: number; code: string };

// Codes are saved and looked up in capital letters, whatever case the caller gives.
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// Selected themes must all exist and have a payment provider product (the discount is attached to those products).
async function assertThemesAreSynced(input: CouponInput): Promise<void> {
  if (input.appliesTo !== "selected") return;
  const themeIds = [...new Set(input.themeIds)];
  const themes = await getThemesProviderInfo(themeIds);
  const areAllSynced = themes.length === themeIds.length && themes.every((theme) => theme.productId !== null);
  if (!areAllSynced) throw new AppError("INVALID", COUPON_MESSAGES.themesNotSynced);
}

// Turns a unique-index error (the code) into the message for the admin. Other errors pass through.
function throwCodeConflict(error: unknown): never {
  if (isDuplicateKeyError(error)) throw new AppError("CONFLICT", COUPON_MESSAGES.codeUsed);
  throw error;
}

// The product ids of the coupon's themes: null for "all", the synced ones for "selected".
async function findProductIds(coupon: CouponRecord): Promise<string[] | null> {
  if (coupon.appliesTo === "all") return null;
  const themes = await getThemesProviderInfo(coupon.themeIds.map((themeId) => themeId.toString()));
  return themes.flatMap((theme) => theme.productId ?? []);
}

// Sends the coupon to the payment provider as a new discount and saves the discount id. Returns false on failure.
async function syncCouponNow(coupon: CouponRecord): Promise<boolean> {
  const productIds = await findProductIds(coupon);
  if (productIds !== null && productIds.length === 0) return false;
  const couponId = coupon._id.toString();
  const result = await syncCouponDiscount({
    couponId,
    code: coupon.code,
    type: coupon.type,
    percentOff: coupon.percentOff ?? null,
    amountOffCents: coupon.amountOffCents ?? null,
    productIds,
    existingDiscountId: null,
  });
  if (!result.ok) return false;
  await couponRepository.setCouponProvider(couponId, { discountId: result.discountId, syncedAt: now() });
  return true;
}

async function readDiscountId(couponId: string): Promise<string | null> {
  const coupon = await couponRepository.findCouponById(couponId);
  return coupon?.provider.discountId ?? null;
}

function sameThemes(saved: CouponRecord, input: CouponInput): boolean {
  const savedIds = saved.themeIds.map((themeId) => themeId.toString());
  return savedIds.length === input.themeIds.length && input.themeIds.every((themeId) => savedIds.includes(themeId));
}

// True when the discount at the payment provider no longer matches the coupon.
function hasDiscountChanged(saved: CouponRecord, input: CouponInput): boolean {
  return (
    input.code !== saved.code ||
    input.type !== saved.type ||
    input.percentOff !== (saved.percentOff ?? null) ||
    input.amountOffCents !== (saved.amountOffCents ?? null) ||
    input.appliesTo !== saved.appliesTo ||
    !sameThemes(saved, input)
  );
}

// Creates a coupon and sends it to the payment provider. A failed sync keeps the coupon.
export async function createCoupon(rawInput: CouponInput, adminUserId: string): Promise<{ id: string }> {
  const input = { ...rawInput, code: normalizeCode(rawInput.code) };
  await assertThemesAreSynced(input);
  let created: CouponRecord;
  try {
    created = await couponRepository.insertCoupon(input);
  } catch (error) {
    return throwCodeConflict(error);
  }
  const id = created._id.toString();
  await activityService.log({
    action: "coupon_created",
    actorRole: "admin",
    actorUserId: adminUserId,
    subjectUserId: null,
    targetType: "coupon",
    targetId: id,
    summary: `Coupon created: ${created.code}`,
  });
  await syncCouponNow(created);
  return { id };
}

// Changes every field of a coupon. When the discount changes, it is replaced at the payment provider.
export async function updateCoupon(id: string, rawInput: CouponUpdateInput): Promise<void> {
  const input = { ...rawInput, code: normalizeCode(rawInput.code) };
  const saved = await couponRepository.findCouponById(id);
  if (!saved) throw new AppError("NOT_FOUND", COUPON_MESSAGES.notFound);
  await assertThemesAreSynced(input);
  let updated: CouponRecord | null;
  try {
    updated = await couponRepository.updateCouponFields(id, input);
  } catch (error) {
    return throwCodeConflict(error);
  }
  if (!updated) throw new AppError("NOT_FOUND", COUPON_MESSAGES.notFound);
  if (!hasDiscountChanged(saved, input)) return;
  const isSynced = await syncCouponNow(updated);
  if (!isSynced) await couponRepository.setCouponProvider(id, { discountId: null, syncedAt: null });
  const oldDiscountId = saved.provider.discountId ?? null;
  const newDiscountId = isSynced ? await readDiscountId(id) : null;
  if (oldDiscountId !== null && oldDiscountId !== newDiscountId) await deleteCouponDiscount(oldDiscountId);
}

// Deletes a coupon, then its discount at the payment provider. Orders and wallet payments are not touched.
export async function deleteCoupon(id: string): Promise<void> {
  const saved = await couponRepository.findCouponById(id);
  if (!saved) throw new AppError("NOT_FOUND", COUPON_MESSAGES.notFound);
  const wasDeleted = await couponRepository.deleteCouponById(id);
  if (!wasDeleted) throw new AppError("NOT_FOUND", COUPON_MESSAGES.notFound);
  const discountId = saved.provider.discountId ?? null;
  if (discountId !== null) await deleteCouponDiscount(discountId);
}

function toDiscountCents(coupon: CouponRecord, priceCents: number): number {
  if (coupon.type === "percent") return Math.round((priceCents * (coupon.percentOff ?? 0)) / 100);
  return coupon.amountOffCents ?? 0;
}

// The one price check for card and wallet checkout (docs/06-payments.md section 4). Writes nothing.
export async function quote(input: QuoteInput): Promise<CouponQuote> {
  const coupon = await couponRepository.findCouponByCode(normalizeCode(input.code));
  if (!coupon || !coupon.active) throw new AppError("INVALID", COUPON_MESSAGES.notValid);
  if (coupon.expiresAt && coupon.expiresAt <= now()) throw new AppError("INVALID", COUPON_MESSAGES.expired);
  if (coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined) {
    if (coupon.redemptionsCount >= coupon.maxRedemptions) throw new AppError("INVALID", COUPON_MESSAGES.limitReached);
  }
  const isForTheme =
    coupon.appliesTo === "all" || coupon.themeIds.some((themeId) => themeId.toString() === input.themeId);
  if (!isForTheme) throw new AppError("INVALID", COUPON_MESSAGES.wrongTheme);
  const discountCents = toDiscountCents(coupon, input.priceCents);
  const finalCents = input.priceCents - discountCents;
  if (finalCents < MIN_FINAL_PRICE_CENTS) throw new AppError("INVALID", COUPON_MESSAGES.wrongTheme);
  return { couponId: coupon._id.toString(), code: coupon.code, discountCents, finalCents };
}

// The discount id for a card checkout. A coupon that is not at the payment provider yet is sent now.
export async function ensureDiscountId(couponId: string): Promise<string | null> {
  const coupon = await couponRepository.findCouponById(couponId);
  if (!coupon) return null;
  if (coupon.provider.discountId) return coupon.provider.discountId;
  const isSynced = await syncCouponNow(coupon);
  return isSynced ? readDiscountId(couponId) : null;
}

// Adds 1 to the redemptions of a coupon. Called inside the order transaction (T-012 / T-013).
export async function recordRedemption(couponId: string, session: ClientSession): Promise<void> {
  await couponRepository.incrementRedemptions(couponId, session);
}

// The id and code of a coupon, or null for an unknown or invalid id.
export async function getCouponSummary(couponId: string): Promise<{ id: string; code: string } | null> {
  const coupon = await couponRepository.findCouponById(couponId);
  return coupon ? { id: coupon._id.toString(), code: coupon.code } : null;
}

// A coupon for the admin edit page, or null for an unknown or invalid id.
export async function getCouponForAdmin(id: string): Promise<CouponAdminDTO | null> {
  const coupon = await couponRepository.findCouponById(id);
  if (!coupon) return null;
  const themes = await getThemesProviderInfo(coupon.themeIds.map((themeId) => themeId.toString()));
  return toCouponAdminDTO(
    coupon,
    themes.map((theme) => theme.name),
  );
}

// All coupons for the admin list, newest first.
export async function listCouponsForAdmin(): Promise<CouponListItemDTO[]> {
  const coupons = await couponRepository.listCoupons();
  return coupons.map(toCouponListItemDTO);
}
