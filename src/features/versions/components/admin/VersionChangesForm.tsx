"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/shared/types/action";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { FormError } from "@/shared/ui/FormError";
import {
  ChangesEditor,
  toChangeEntries,
  toChangeRows,
  type ChangeRow,
} from "@/features/versions/components/admin/ChangesEditor";
import { updateVersionChangesAction } from "@/features/versions/version.actions";
import type { ChangeEntryDTO } from "@/features/versions/version.types";

type VersionChangesFormProps = {
  versionId: string;
  changes: ChangeEntryDTO[];
};

export function VersionChangesForm({ versionId, changes }: VersionChangesFormProps) {
  const [rows, setRows] = useState<ChangeRow[]>(() => toChangeRows(changes));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isSaving, startTransition] = useTransition();
  const failure = result?.ok === false ? result : null;
  const fieldErrors = failure?.fieldErrors ?? {};
  const formError = failure && !failure.fieldErrors ? failure.error : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        startTransition(async () => {
          setResult(await updateVersionChangesAction({ versionId, changes: toChangeEntries(rows) }));
        });
      }}
    >
      <Stack>
        {result?.ok ? <Alert tone="success">{result.message}</Alert> : null}
        <FormError message={formError} />
        <ChangesEditor changes={rows} onChange={setRows} errors={fieldErrors.changes} />
        <div>
          <Button type="submit" disabled={isSaving}>
            Save changes
          </Button>
        </div>
      </Stack>
    </form>
  );
}
