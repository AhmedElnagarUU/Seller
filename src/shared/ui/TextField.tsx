import { useId } from "react";
import clsx from "clsx";
import { Text } from "@/shared/ui/Text";

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "url" | "number" | "tel";
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  errors?: string[];
  id?: string;
  step?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email";
};

const INPUT_CLASSES =
  "w-full rounded-md border bg-background px-3 py-2 text-base text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
  hint,
  errors = [],
  id,
  step,
  inputMode,
}: TextFieldProps) {
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
        type={type}
        step={step}
        inputMode={inputMode}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
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
