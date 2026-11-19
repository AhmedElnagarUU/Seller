"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readCheckbox, readText } from "@/shared/lib/form-data";
import { requireAdmin } from "@/features/auth/session";
import { SETTINGS_MESSAGES } from "@/features/settings/settings.constants";
import { walletSettingsSchema } from "@/features/settings/settings.schemas";
import { updateWalletSettings } from "@/features/settings/settings.service";
import type { WalletAccountFields } from "@/features/settings/settings.types";

function readTexts(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

// The account rows of the form: three lists zipped by index.
function readAccountRows(formData: FormData): WalletAccountFields[] {
  const labels = readTexts(formData, "walletLabel");
  const accounts = readTexts(formData, "walletAccount");
  const instructions = readTexts(formData, "walletInstructions");
  return labels.map((label, index) => ({
    label,
    account: accounts[index] ?? "",
    instructions: instructions[index] ?? "",
  }));
}

export async function saveWalletSettingsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const rows = readAccountRows(formData);
  const walletEnabled = readCheckbox(formData, "walletEnabled");
  const usdToEgpRate = readText(formData, "usdToEgpRate");
  const values = { walletEnabled: walletEnabled ? "on" : "", usdToEgpRate, rows: JSON.stringify(rows) };
  const parsed = walletSettingsSchema.safeParse({ walletEnabled, usdToEgpRate, walletAccounts: rows });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await updateWalletSettings(parsed.data);
  } catch (error) {
    return failureFrom(error, "saveWalletSettingsAction", values);
  }
  revalidatePath("/admin/settings");
  revalidatePath("/checkout/[slug]", "page");
  return { ok: true, data: undefined, message: SETTINGS_MESSAGES.saved };
}
