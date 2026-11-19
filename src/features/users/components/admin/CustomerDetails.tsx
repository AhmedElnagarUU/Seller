import { formatDate } from "@/shared/lib/dates";
import { Stack } from "@/shared/layout/Stack";
import { Text } from "@/shared/ui/Text";
import type { CustomerDetailDTO } from "@/features/users/user.types";

type CustomerDetailsProps = {
  customer: CustomerDetailDTO;
};

export function CustomerDetails({ customer }: CustomerDetailsProps) {
  return (
    <Stack gap="xs">
      <Text>{`Email: ${customer.email} (${customer.emailVerified ? "verified" : "not verified"})`}</Text>
      <Text>{`Country: ${customer.country ?? "—"}`}</Text>
      <Text>{`Joined: ${formatDate(customer.createdAt)}`}</Text>
      {customer.isDisabled ? (
        <Text tone="danger">
          {`Disabled${customer.disabledAt ? ` on ${formatDate(customer.disabledAt)}` : ""}: ${customer.disabledReason ?? "—"}`}
        </Text>
      ) : null}
    </Stack>
  );
}
