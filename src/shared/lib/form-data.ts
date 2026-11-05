// Reads a text field from a form. A missing or non-text field gives "".
export function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Reads a checkbox: true when it was checked.
export function readCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) !== null;
}

// Reads a textarea with one item per line. Lines are trimmed and empty lines are dropped.
export function readLines(formData: FormData, key: string): string[] {
  return readText(formData, key)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
