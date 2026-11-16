import { getPaymentProvider } from "@/features/payments/payment.provider";

export type ThemeSyncInput = {
  themeId: string;
  name: string;
  tagline: string;
  priceCents: number;
  existingProductId: string | null;
};

export type ThemeSyncResult = { ok: true; productId: string } | { ok: false };

// Sends the theme to the payment provider. A failure is logged and returned, never thrown.
export async function syncThemeProduct(input: ThemeSyncInput): Promise<ThemeSyncResult> {
  try {
    const { productId } = await getPaymentProvider().upsertProduct(input);
    return { ok: true, productId };
  } catch (error) {
    console.error("syncThemeProduct failed", error);
    return { ok: false };
  }
}
