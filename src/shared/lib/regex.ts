// Escapes regex characters so user text can be used as a literal "contains" search.
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
