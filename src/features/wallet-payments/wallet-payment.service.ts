import { AppError } from "@/shared/errors";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";
import { usdCentsToEgpPounds } from "@/shared/lib/money";
import { quote } from "@/features/coupons/coupon.service";
import type { CouponQuote } from "@/features/coupons/coupon.types";
import { hasActiveOwnership } from "@/features/ownerships/ownership.service";
import { getWalletSettings } from "@/features/settings/settings.service";
import { getThemeForPurchase } from "@/features/themes/theme.service";
import type { ThemePurchaseDTO } from "@/features/themes/theme.types";
import { getUserSummary } from "@/features/users/user.service";
import { MAX_REFERENCE_TRIES, WALLET_MESSAGES } from "@/features/wallet-payments/wallet-payment.constants";
import { toWalletPaymentDTO, toWalletPaymentListItemDTO } from "@/features/wallet-payments/wallet-payment.mapper";
import type { WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";
import { generateReferenceCode } from "@/features/wallet-payments/wallet-payment.reference";
import * as walletPaymentRepository from "@/features/wallet-payments/wallet-payment.repository";
import type { NewWalletPaymentFields } from "@/features/wallet-payments/wallet-payment.repository";
import type { WalletPaymentListItemDTO, WalletPaymentPageDTO } from "@/features/wallet-payments/wallet-payment.types";

const EGYPT_COUNTRY_CODE = "EG";

type StartWalletPaymentInput = { userId: string; themeSlug: string; couponCode: string | null };

type NewRequestFields = Omit<NewWalletPaymentFields, "referenceCode">;

// True when the error is a duplicate key on the reference code. Another duplicate (the open request) is a different case.
function isReferenceCollision(error: unknown): boolean {
  if (!isDuplicateKeyError(error)) return false;
  if (typeof error !== "object" || error === null || !("keyPattern" in error)) return false;
  const keyPattern = error.keyPattern;
  return typeof keyPattern === "object" && keyPattern !== null && "referenceCode" in keyPattern;
}

// Inserts the request with a new reference code. A code that is taken is replaced by a new one (docs/06 section 7.3).
export async function insertWithUniqueReference(
  fields: NewRequestFields,
  generate: () => string = generateReferenceCode,
): Promise<WalletPaymentRecord> {
  for (let attempt = 0; attempt < MAX_REFERENCE_TRIES; attempt += 1) {
    try {
      return await walletPaymentRepository.insertWalletPayment({ ...fields, referenceCode: generate() });
    } catch (error) {
      if (!isReferenceCollision(error)) throw error;
    }
  }
  throw new Error(WALLET_MESSAGES.referenceFailed);
}

async function assertCanStart(userId: string, themeSlug: string): Promise<ThemePurchaseDTO> {
  const user = await getUserSummary(userId);
  if (user?.country !== EGYPT_COUNTRY_CODE) throw new AppError("FORBIDDEN", WALLET_MESSAGES.notEgypt);
  const settings = await getWalletSettings();
  if (!settings.walletEnabled) throw new AppError("INVALID", WALLET_MESSAGES.disabled);
  const theme = await getThemeForPurchase(themeSlug);
  if (theme?.status !== "published") throw new AppError("NOT_FOUND", WALLET_MESSAGES.themeUnavailable);
  if (await hasActiveOwnership(userId, theme.id)) throw new AppError("CONFLICT", WALLET_MESSAGES.alreadyOwned);
  return theme;
}

async function findCouponQuote(theme: ThemePurchaseDTO, couponCode: string | null): Promise<CouponQuote | null> {
  if (!couponCode) return null;
  return quote({ themeId: theme.id, priceCents: theme.priceCents, code: couponCode });
}

// Starts a wallet payment: the 9 steps of docs/06-payments.md section 7.1. An open request is returned as it is.
export async function startWalletPayment(input: StartWalletPaymentInput): Promise<{ id: string }> {
  const theme = await assertCanStart(input.userId, input.themeSlug);
  const open = await walletPaymentRepository.findOpenWalletPayment(input.userId, theme.id);
  if (open) return { id: open._id.toString() };
  const couponQuote = await findCouponQuote(theme, input.couponCode);
  const { usdToEgpRate } = await getWalletSettings();
  const fields: NewRequestFields = {
    userId: input.userId,
    themeId: theme.id,
    themeSnapshot: { name: theme.name, slug: theme.slug },
    usdPriceCents: theme.priceCents,
    usdDiscountCents: couponQuote?.discountCents ?? 0,
    couponId: couponQuote?.couponId ?? null,
    couponCode: couponQuote?.code ?? null,
    exchangeRate: usdToEgpRate,
    amountEgp: usdCentsToEgpPounds(couponQuote?.finalCents ?? theme.priceCents, usdToEgpRate),
  };
  try {
    const created = await insertWithUniqueReference(fields);
    return { id: created._id.toString() };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A parallel request created the open request first.
    const winner = await walletPaymentRepository.findOpenWalletPayment(input.userId, theme.id);
    if (!winner) throw error;
    return { id: winner._id.toString() };
  }
}

// The customer gives up a request that is still waiting for payment. No log (docs/03-data-model.md section 15).
export async function cancelWalletPayment(input: { userId: string; walletPaymentId: string }): Promise<void> {
  const payment = await walletPaymentRepository.findWalletPaymentForUser(input.userId, input.walletPaymentId);
  if (!payment) throw new AppError("NOT_FOUND", WALLET_MESSAGES.notFound);
  if (payment.status !== "awaiting_payment") throw new AppError("CONFLICT", WALLET_MESSAGES.notChangeable);
  const wasCancelled = await walletPaymentRepository.cancelAwaitingWalletPayment(input.userId, input.walletPaymentId);
  if (!wasCancelled) throw new AppError("CONFLICT", WALLET_MESSAGES.notChangeable);
}

// The data of /account/wallet-payments/[id], or null when it is not a request of this user.
// The wallet accounts are only needed while the customer still has to pay.
export async function getWalletPaymentPageData(
  userId: string,
  walletPaymentId: string,
): Promise<WalletPaymentPageDTO | null> {
  const payment = await walletPaymentRepository.findWalletPaymentForUser(userId, walletPaymentId);
  if (!payment) return null;
  const accounts = payment.status === "awaiting_payment" ? (await getWalletSettings()).walletAccounts : [];
  return { payment: toWalletPaymentDTO(payment), accounts };
}

// All wallet requests of a customer, newest first.
export async function listWalletPaymentsForUser(userId: string): Promise<WalletPaymentListItemDTO[]> {
  const payments = await walletPaymentRepository.findWalletPaymentsForUser(userId);
  return payments.map(toWalletPaymentListItemDTO);
}
