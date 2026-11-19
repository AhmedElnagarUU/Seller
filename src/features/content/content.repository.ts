import { readFile } from "node:fs/promises";
import path from "node:path";
import type { InfoPageSlug } from "@/features/content/content.constants";

// Reads `src/content/<slug>.md` as text. A missing file gives null. The only file that uses `node:fs`.
export async function readContentFile(slug: InfoPageSlug): Promise<string | null> {
  const filePath = path.join(process.cwd(), "src", "content", `${slug}.md`);
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}
