import { useId } from "react";
import clsx from "clsx";
import { Text } from "@/shared/ui/Text";

type FileFieldProps = {
  label: string;
  name: string;
  accept?: string;
  disabled?: boolean;
  hint?: string;
  errors?: string[];
  id?: string;
  onChange?: (file: File | null) => void;
};

const INPUT_CLASSES =
  "w-full rounded-md border bg-background px-3 py-2 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50";

export function FileField({ label, name, accept, disabled, hint, errors = [], id, onChange }: FileFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorsId = `${fieldId}-errors`;
  const hasErrors = errors.length > 0;
  const describedBy = [hint ? hintId : null, hasErrors ? errorsId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-text text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.files?.[0] ?? null)}
        aria-invalid={hasErrors ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={clsx(INPUT_CLASSES, hasErrors ? "border-danger" : "border-border")}
      />
      {hint ? (
        <span id={hintId}>
          <Text size="sm" tone="muted">
            {hint}
          </Text>
        </span>
      ) : null}
      {hasErrors ? (
        <div id={errorsId}>
          {errors.map((error) => (
            <Text key={error} size="sm" tone="danger">
              {error}
            </Text>
          ))}
        </div>
      ) : null}
    </div>
  );
}
