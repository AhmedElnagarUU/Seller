"use client";

import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { SelectField } from "@/shared/ui/SelectField";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { CHANGE_TYPE_LABELS, CHANGE_TYPES, type ChangeType } from "@/features/versions/version.constants";
import type { ChangeEntryDTO } from "@/features/versions/version.types";

// One row of the editor. `rowId` keeps a row's fields in place when another row is removed.
export type ChangeRow = { rowId: number; type: ChangeType; text: string };

type ChangesEditorProps = {
  changes: ChangeRow[];
  onChange: (changes: ChangeRow[]) => void;
  errors?: string[];
};

const TYPE_OPTIONS = CHANGE_TYPES.map((type) => ({ value: type, label: CHANGE_TYPE_LABELS[type] }));

function isChangeType(value: string): value is ChangeType {
  return CHANGE_TYPES.some((type) => type === value);
}

function nextRowId(rows: ChangeRow[]): number {
  return rows.reduce((highest, row) => Math.max(highest, row.rowId + 1), 0);
}

// A new empty row of type "new" after the rows given.
export function withEmptyRow(rows: ChangeRow[]): ChangeRow[] {
  return [...rows, { rowId: nextRowId(rows), type: "new", text: "" }];
}

export function toChangeRows(changes: ChangeEntryDTO[]): ChangeRow[] {
  return changes.map((change, index) => ({ rowId: index, type: change.type, text: change.text }));
}

// The rows without their ids, as the actions expect them.
export function toChangeEntries(rows: ChangeRow[]): ChangeEntryDTO[] {
  return rows.map((row) => ({ type: row.type, text: row.text }));
}

export function ChangesEditor({ changes, onChange, errors = [] }: ChangesEditorProps) {
  // The kit fields have no onChange, so each row listens to the change events that bubble up from its fields.
  function updateRow(rowId: number, field: string, value: string): void {
    onChange(
      changes.map((row) => {
        if (row.rowId !== rowId) return row;
        if (field === "type" && isChangeType(value)) return { ...row, type: value };
        if (field === "text") return { ...row, text: value };
        return row;
      }),
    );
  }

  return (
    <Stack>
      {changes.map((row, index) => (
        <div
          key={row.rowId}
          onChange={(event) => {
            const target = event.target;
            const isField = target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
            if (isField) updateRow(row.rowId, target.name, target.value);
          }}
        >
          <Inline align="end" wrap>
            <SelectField
              label={`Type of change ${index + 1}`}
              name="type"
              options={TYPE_OPTIONS}
              defaultValue={row.type}
            />
            <TextField label={`Text of change ${index + 1}`} name="text" defaultValue={row.text} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange(changes.filter((other) => other.rowId !== row.rowId))}
            >
              Remove change {index + 1}
            </Button>
          </Inline>
        </div>
      ))}
      {errors.map((error) => (
        <Text key={error} size="sm" tone="danger">
          {error}
        </Text>
      ))}
      <div>
        <Button variant="secondary" onClick={() => onChange(withEmptyRow(changes))}>
          Add change
        </Button>
      </div>
    </Stack>
  );
}
