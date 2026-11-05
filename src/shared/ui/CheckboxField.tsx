import { useId } from "react";
import { Text } from "@/shared/ui/Text";

type CheckboxFieldProps = {
  label: string;
  name: string;
  defaultChecked?: boolean;
  value?: string;
  hint?: string;
  errors?: string[];
  id?: string;
};

export function CheckboxField({
  label,
  name,
  defaultChecked,
  value = "on",
  hint,
  errors = [],
  id,
}: CheckboxFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorsId = `${fieldId}-errors`;
  const hasErrors = errors.length > 0;
  const describedBy = [hint ? hintId : null, hasErrors ? errorsId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={fieldId}
          name={name}
          type="checkbox"
          value={value}
          defaultChecked={defaultChecked}
          aria-invalid={hasErrors ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="border-border accent-primary focus-visible:outline-focus size-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <label htmlFor={fieldId} className="text-text text-sm">
          {label}
        </label>
      </div>
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
