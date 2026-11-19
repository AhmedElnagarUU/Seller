"use client";

import { useActionState } from "react";
import { formKey } from "@/shared/lib/action-result";
import { formatDateTime } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { ProofImage } from "@/shared/ui/ProofImage";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import {
  approveWalletPaymentAction,
  rejectWalletPaymentAction,
} from "@/features/wallet-payments/wallet-payment.actions";
import { WALLET_STATUS_LABELS } from "@/features/wallet-payments/wallet-payment.constants";
import type { WalletPaymentAdminDTO } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type WalletReviewPanelProps = {
  payment: WalletPaymentAdminDTO;
};

function Details({ payment }: WalletReviewPanelProps) {
  return (
    <Stack gap="xs">
      <Text>{`Customer: ${payment.customer.name} (${payment.customer.email})`}</Text>
      <Text>{`Theme: ${payment.themeName}`}</Text>
      <Text>{`Amount: ${formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp")}`}</Text>
      <Text>{`Reference: ${payment.referenceCode}`}</Text>
      <Text>{`Phone: ${payment.senderPhone ?? "—"}`}</Text>
      <Text>{`Transaction ID: ${payment.transactionId ?? "—"}`}</Text>
      <Text>{`Submitted: ${payment.submittedAt ? formatDateTime(payment.submittedAt) : "—"}`}</Text>
    </Stack>
  );
}

function ReviewResult({ payment }: WalletReviewPanelProps) {
  return (
    <Stack gap="xs">
      <Text>{WALLET_STATUS_LABELS[payment.status]}</Text>
      {payment.reviewedAt ? <Text>{`Reviewed: ${formatDateTime(payment.reviewedAt)}`}</Text> : null}
      {payment.status === "rejected" ? <Text>{`Reason: ${payment.rejectionReason ?? ""}`}</Text> : null}
    </Stack>
  );
}

export function WalletReviewPanel({ payment }: WalletReviewPanelProps) {
  // Both states live here, so a success message stays visible after the page shows the new status.
  const [approveState, approveAction] = useActionState(approveWalletPaymentAction, null);
  const [rejectState, rejectAction] = useActionState(rejectWalletPaymentAction, null);

  return (
    <Stack gap="lg">
      <Details payment={payment} />
      {payment.proofUrl ? <ProofImage src={payment.proofUrl} alt="Transfer screenshot" /> : null}
      {approveState?.ok ? <Alert tone="success">{approveState.message}</Alert> : null}
      {rejectState?.ok ? <Alert tone="success">{rejectState.message}</Alert> : null}
      {payment.status === "submitted" ? (
        <Stack>
          <Alert tone="warning">
            Check that the money really arrived in your wallet (amount and reference) before you approve.
          </Alert>
          <form action={approveAction}>
            <Stack>
              <FormError message={approveState?.ok === false ? approveState.error : null} />
              <input type="hidden" name="id" value={payment.id} />
              <SubmitButton pendingText="Approving…">Approve</SubmitButton>
            </Stack>
          </form>
          <form key={formKey(rejectState)} action={rejectAction}>
            <Stack>
              <FormError message={rejectState?.ok === false ? rejectState.error : null} />
              <input type="hidden" name="id" value={payment.id} />
              <TextAreaField
                label="Reason for the customer"
                name="reason"
                defaultValue={rejectState?.ok === false ? (rejectState.values?.reason ?? "") : ""}
              />
              <SubmitButton variant="danger" pendingText="Rejecting…">
                Reject
              </SubmitButton>
            </Stack>
          </form>
        </Stack>
      ) : (
        <ReviewResult payment={payment} />
      )}
    </Stack>
  );
}
