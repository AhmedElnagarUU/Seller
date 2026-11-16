"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import type { ActionResult } from "@/shared/types/action";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { PublishChecklist } from "@/features/themes/components/admin/PublishChecklist";
import { publishThemeAction, syncThemeAction, unpublishThemeAction } from "@/features/themes/theme-publish.actions";
import type { PublishChecklistDTO } from "@/features/themes/theme.types";

type PublishPanelProps = {
  themeId: string;
  checklist: PublishChecklistDTO;
};

type ThemeFormProps = {
  themeId: string;
  formAction: (formData: FormData) => void;
  state: ActionResult | null;
  // The result of the other action that led to this form (publishing shows the Unpublish form, and back).
  otherState: ActionResult | null;
};

function errorOf(state: ActionResult | null): string | null {
  return state?.ok === false ? state.error : null;
}

function SuccessMessage({ state }: { state: ActionResult | null }) {
  return state?.ok ? <Alert tone="success">{state.message}</Alert> : null;
}

// The status changes after a successful publish, so the form that ran the action is replaced by the next one.
// That is why the panel owns the action states and each form also shows the success of the action before it.
function SyncForm({ themeId, formAction, state }: Omit<ThemeFormProps, "otherState">) {
  return (
    <form action={formAction}>
      <Stack>
        <FormError message={errorOf(state)} />
        <SuccessMessage state={state} />
        <input type="hidden" name="id" value={themeId} />
        <SubmitButton variant="secondary" pendingText="Syncing…">
          Sync now
        </SubmitButton>
      </Stack>
    </form>
  );
}

function UnpublishForm({ themeId, formAction, state, otherState }: ThemeFormProps) {
  return (
    <form action={formAction}>
      <Stack>
        <FormError message={errorOf(state)} />
        <SuccessMessage state={otherState} />
        <input type="hidden" name="id" value={themeId} />
        <SubmitButton variant="danger" pendingText="Unpublishing…">
          Unpublish
        </SubmitButton>
      </Stack>
    </form>
  );
}

function PublishForm({ themeId, formAction, state, otherState, canPublish }: ThemeFormProps & { canPublish: boolean }) {
  return (
    <form action={formAction}>
      <Stack>
        <FormError message={errorOf(state)} />
        <SuccessMessage state={otherState} />
        <input type="hidden" name="id" value={themeId} />
        {canPublish ? (
          <SubmitButton pendingText="Publishing…">Publish</SubmitButton>
        ) : (
          <Button disabled>Publish</Button>
        )}
      </Stack>
    </form>
  );
}

export function PublishPanel({ themeId, checklist }: PublishPanelProps) {
  const [syncState, syncAction] = useActionState(syncThemeAction, null);
  const [publishState, publishAction] = useActionState(publishThemeAction, null);
  const [unpublishState, unpublishAction] = useActionState(unpublishThemeAction, null);

  return (
    <Stack>
      <PublishChecklist checklist={checklist} />
      {checklist.isSynced ? null : <SyncForm themeId={themeId} formAction={syncAction} state={syncState} />}
      {checklist.status === "published" ? (
        <UnpublishForm
          themeId={themeId}
          formAction={unpublishAction}
          state={unpublishState}
          otherState={publishState}
        />
      ) : (
        <PublishForm
          themeId={themeId}
          formAction={publishAction}
          state={publishState}
          otherState={unpublishState}
          canPublish={checklist.canPublish}
        />
      )}
    </Stack>
  );
}
