import { Text } from "@/shared/ui/Text";
import { ACCOUNT_MESSAGES } from "@/features/users/account.messages";

type DeleteAccountCardProps = {
  supportEmail: string;
};

export function DeleteAccountCard({ supportEmail }: DeleteAccountCardProps) {
  return (
    <Text>
      {ACCOUNT_MESSAGES.deleteAccount} {supportEmail}.
    </Text>
  );
}
