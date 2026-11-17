"use client";

import { useActionState } from "react";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { createCouponAction, updateCouponAction } from "@/features/coupons/coupon.actions";
import type { CouponAdminDTO } from "@/features/coupons/coupon.types";

const CENTS_PER_DOLLAR = 100;
const DATE_TEXT_LENGTH = 10;

const TYPE_OPTIONS = [
  { value: "percent", label: "Percent" },
  { value: "fixed", label: "Fixed amount" },
];

const APPLIES_TO_OPTIONS = [
  { value: "all", label: "All themes" },
  { value: "selected", label: "Selected themes" },
];

type CouponFormProps = {
  coupon?: CouponAdminDTO;
  themeChoices: { id: string; name: string }[];
};

// 20 becomes "20"; 500 cents become "5.00".
function toValueText(coupon: CouponAdminDTO): string {
  if (coupon.type === "percent") return String(coupon.percentOff ?? "");
  return ((coupon.amountOffCents ?? 0) / CENTS_PER_DOLLAR).toFixed(2);
}

// A date becomes "YYYY-MM-DD" (UTC), the format of a date field.
function toDateText(date: Date | null): string {
  return date ? date.toISOString().slice(0, DATE_TEXT_LENGTH) : "";
}

export function CouponForm({ coupon, themeChoices }: CouponFormProps) {
  const [state, formAction] = useActionState(coupon ? updateCouponAction : createCouponAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  // What the user typed before an error, otherwise the saved value.
  const valueOf = (key: string, initial: string): string => submittedValue(state, key, initial);

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        {coupon ? <input type="hidden" name="id" value={coupon.id} /> : null}
        <TextField
          label="Code"
          name="code"
          defaultValue={valueOf("code", coupon?.code ?? "")}
          hint="Letters, numbers and dashes. Saved in capital letters."
          required
          errors={fieldErrors?.code}
        />
        <SelectField
          label="Type"
          name="type"
          options={TYPE_OPTIONS}
          defaultValue={valueOf("type", coupon?.type ?? "percent")}
          errors={fieldErrors?.type}
        />
        <TextField
          label="Value"
          name="value"
          defaultValue={valueOf("value", coupon ? toValueText(coupon) : "")}
          hint="Percent: a whole number from 1 to 100. Fixed amount: dollars, for example 5.00."
          inputMode="decimal"
          required
          errors={fieldErrors?.value}
        />
        <SelectField
          label="Applies to"
          name="appliesTo"
          options={APPLIES_TO_OPTIONS}
          defaultValue={valueOf("appliesTo", coupon?.appliesTo ?? "all")}
          errors={fieldErrors?.appliesTo}
        />
        <Stack gap="xs">
          <Text weight="bold">Themes</Text>
          {themeChoices.map((theme) => (
            <CheckboxField
              key={theme.id}
              label={theme.name}
              name="themeIds"
              value={theme.id}
              defaultChecked={coupon?.themeIds.includes(theme.id) ?? false}
            />
          ))}
          {fieldErrors?.themeIds?.map((error) => (
            <Text key={error} size="sm" tone="danger">
              {error}
            </Text>
          ))}
        </Stack>
        <TextField
          label="Expires at"
          name="expiresAt"
          type="date"
          defaultValue={valueOf("expiresAt", toDateText(coupon?.expiresAt ?? null))}
          hint="Optional."
          errors={fieldErrors?.expiresAt}
        />
        <TextField
          label="Usage limit"
          name="maxRedemptions"
          type="number"
          inputMode="numeric"
          defaultValue={valueOf("maxRedemptions", coupon?.maxRedemptions?.toString() ?? "")}
          hint="Optional. Leave empty for no limit."
          errors={fieldErrors?.maxRedemptions}
        />
        {coupon ? (
          <>
            <CheckboxField
              label="Active"
              name="active"
              defaultChecked={valueOf("active", coupon.active ? "on" : "") === "on"}
            />
            <Text>Used: {coupon.redemptionsCount}</Text>
            {coupon.isSynced ? null : (
              <Text tone="muted">
                Not synced with the payment provider yet. It is tried again at the first card checkout.
              </Text>
            )}
          </>
        ) : null}
        <SubmitButton pendingText={coupon ? "Saving…" : "Creating…"}>
          {coupon ? "Save changes" : "Create coupon"}
        </SubmitButton>
      </Stack>
    </form>
  );
}
