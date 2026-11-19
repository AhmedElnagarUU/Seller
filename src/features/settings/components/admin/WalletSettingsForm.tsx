"use client";

import { useActionState, useState } from "react";
import { z } from "zod";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { saveWalletSettingsAction } from "@/features/settings/settings.actions";
import { MAX_WALLET_ACCOUNTS } from "@/features/settings/settings.constants";
import type { WalletAccountFields, WalletSettingsDTO } from "@/features/settings/settings.types";

type EditorRow = WalletAccountFields & { key: number };

type AccountsEditorProps = {
  initialAccounts: WalletAccountFields[];
  errors: string[] | undefined;
};

const typedRowsSchema = z.array(z.object({ label: z.string(), account: z.string(), instructions: z.string() }));

// The typed rows that the action sent back after an error, or null when they cannot be read.
function parseTypedRows(text: string): WalletAccountFields[] | null {
  try {
    const parsed = typedRowsSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function AccountsEditor({ initialAccounts, errors }: AccountsEditorProps) {
  const [rows, setRows] = useState<EditorRow[]>(() => initialAccounts.map((row, index) => ({ ...row, key: index })));

  function addRow(): void {
    setRows((current) => [
      ...current,
      { key: Math.max(-1, ...current.map((row) => row.key)) + 1, label: "", account: "", instructions: "" },
    ]);
  }

  function removeRow(key: number): void {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <Stack>
      <Text weight="bold">Wallet accounts</Text>
      {rows.map((row) => (
        <Stack key={row.key} gap="sm">
          <TextField label="Label" name="walletLabel" defaultValue={row.label} />
          <TextField label="Account" name="walletAccount" defaultValue={row.account} />
          <TextAreaField label="Instructions" name="walletInstructions" defaultValue={row.instructions} rows={2} />
          <Button variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
            Remove
          </Button>
        </Stack>
      ))}
      {errors?.map((error) => (
        <Text key={error} size="sm" tone="danger">
          {error}
        </Text>
      ))}
      <Button variant="secondary" disabled={rows.length >= MAX_WALLET_ACCOUNTS} onClick={addRow}>
        Add account
      </Button>
    </Stack>
  );
}

type WalletSettingsFormProps = {
  settings: WalletSettingsDTO;
};

export function WalletSettingsForm({ settings }: WalletSettingsFormProps) {
  const [state, formAction] = useActionState(saveWalletSettingsAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;
  const typedRows = parseTypedRows(submittedValue(state, "rows", ""));
  const isEnabled = submittedValue(state, "walletEnabled", settings.walletEnabled ? "on" : "") === "on";

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <CheckboxField
          label="Accept Egyptian wallet payments"
          name="walletEnabled"
          defaultChecked={isEnabled}
          errors={fieldErrors?.walletEnabled}
        />
        <TextField
          label="USD → EGP rate"
          name="usdToEgpRate"
          inputMode="decimal"
          defaultValue={submittedValue(state, "usdToEgpRate", String(settings.usdToEgpRate))}
          hint="For example 50.5"
          errors={fieldErrors?.usdToEgpRate}
        />
        <AccountsEditor initialAccounts={typedRows ?? settings.walletAccounts} errors={fieldErrors?.walletAccounts} />
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </Stack>
    </form>
  );
}
