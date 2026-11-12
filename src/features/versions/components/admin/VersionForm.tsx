"use client";

import { useState } from "react";
import { nextPatchVersion } from "@/shared/lib/semver";
import { readCheckbox, readText } from "@/shared/lib/form-data";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FileField } from "@/shared/ui/FileField";
import { FormError } from "@/shared/ui/FormError";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import {
  ChangesEditor,
  toChangeEntries,
  withEmptyRow,
  type ChangeRow,
} from "@/features/versions/components/admin/ChangesEditor";
import { useVersionUpload } from "@/features/versions/components/admin/useVersionUpload";

type VersionFormProps = {
  themeId: string;
  // The newest version of the theme, or null when it has none.
  latestVersion: string | null;
};

export function VersionForm({ themeId, latestVersion }: VersionFormProps) {
  const upload = useVersionUpload(themeId);
  const [changes, setChanges] = useState<ChangeRow[]>(() => withEmptyRow([]));
  const placeholder = latestVersion ? nextPatchVersion(latestVersion) : "1.0.0";
  const formError = Object.keys(upload.fieldErrors).length === 0 ? upload.error : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const file = formData.get("file");
        upload.submit({
          version: readText(formData, "version"),
          changes: toChangeEntries(changes),
          notify: readCheckbox(formData, "notify"),
          file: file instanceof File && file.name !== "" ? file : null,
        });
      }}
    >
      <Stack>
        <FormError message={formError} />
        <TextField label="Version" name="version" placeholder={placeholder} errors={upload.fieldErrors.version} />
        <ChangesEditor changes={changes} onChange={setChanges} errors={upload.fieldErrors.changes} />
        <FileField label="Zip file" name="file" accept=".zip,application/zip" />
        <CheckboxField label="Notify owners and people who favorited this theme" name="notify" defaultChecked />
        {upload.step === "uploading" ? (
          <Stack gap="xs">
            <ProgressBar percent={upload.percent} label="Uploading zip" />
            <Text>Uploading… {upload.percent}%</Text>
          </Stack>
        ) : null}
        {upload.step === "checking" ? <Text>Checking the file…</Text> : null}
        <div>
          <Button type="submit" disabled={upload.isBusy}>
            Upload and release
          </Button>
        </div>
      </Stack>
    </form>
  );
}
