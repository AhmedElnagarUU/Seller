"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { getCountryOptions } from "@/shared/lib/countries";
import { Heading } from "@/shared/ui/Heading";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { setCountryAction } from "@/features/payments/checkout.actions";

type CountryFormProps = {
  slug: string;
  couponCode: string | null;
};

export function CountryForm({ slug, couponCode }: CountryFormProps) {
  const [state, formAction] = useActionState(setCountryAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <Heading level={2}>Choose your country</Heading>
        <Text>We use it to show you the right payment options.</Text>
        <FormError message={state?.ok === false ? state.error : null} />
        <SelectField label="Country" name="country" options={getCountryOptions()} placeholder="Choose your country" />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="coupon" value={couponCode ?? ""} />
        <SubmitButton pendingText="Saving…">Continue</SubmitButton>
      </Stack>
    </form>
  );
}
