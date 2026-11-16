import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { syncThemeProduct } from "@/features/payments/payment-sync.service";
import { THEME_PUBLISH_MESSAGES } from "@/features/themes/theme.constants";
import * as themeRepository from "@/features/themes/theme.repository";

// Sends the theme to the payment provider and saves the product id. Returns false when the theme does not exist
// or the provider failed (nothing is written then). It never throws for a provider failure.
export async function syncThemeWithProvider(themeId: string): Promise<boolean> {
  const theme = await themeRepository.findThemeById(themeId);
  if (!theme) return false;
  const result = await syncThemeProduct({
    themeId,
    name: theme.name,
    tagline: theme.tagline,
    priceCents: theme.priceCents,
    existingProductId: theme.provider.productId ?? null,
  });
  if (!result.ok) return false;
  await themeRepository.setThemeProvider(themeId, { productId: result.productId, syncedAt: now() });
  return true;
}

// The "Sync now" button: tries the sync again and tells the admin when it did not work.
export async function retryThemeSync(themeId: string): Promise<void> {
  const theme = await themeRepository.findThemeById(themeId);
  if (!theme) throw new AppError("NOT_FOUND", THEME_PUBLISH_MESSAGES.notFound);
  const wasSynced = await syncThemeWithProvider(themeId);
  if (!wasSynced) throw new AppError("INVALID", THEME_PUBLISH_MESSAGES.syncFailed);
}
