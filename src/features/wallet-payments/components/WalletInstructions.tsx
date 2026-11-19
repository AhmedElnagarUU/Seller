import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Text } from "@/shared/ui/Text";
import type { WalletAccountDTO } from "@/features/wallet-payments/wallet-payment.types";

type WalletInstructionsProps = {
  accounts: WalletAccountDTO[];
};

// One card for each wallet account that the customer can send the money to.
export function WalletInstructions({ accounts }: WalletInstructionsProps) {
  return (
    <Stack>
      {accounts.map((account) => (
        <Card key={`${account.label}-${account.account}`}>
          <Stack gap="xs">
            <Text weight="bold">{account.label}</Text>
            <Text>{account.account}</Text>
            {account.instructions === "" ? null : <Text tone="muted">{account.instructions}</Text>}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
