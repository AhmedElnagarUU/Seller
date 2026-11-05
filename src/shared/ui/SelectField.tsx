import { useId } from "react";
import clsx from "clsx";
import { Text } from "@/shared/ui/Text";

type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  id?: string;
  placeholder?: string;
};

const SELECT_CLASSES =
  "w-full rounded-md border bg-background px-3 py-2 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  hint,
  errors = [],
  id,
  placeholder,
}: SelectFieldProps) {
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
      <select
        id={fieldId}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={hasErrors ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={clsx(SELECT_CLASSES, hasErrors ? "border-danger" : "border-border")}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
