import { INFO_PAGES } from "@/features/content/content.constants";
import * as contentRepository from "@/features/content/content.repository";
import type { InfoPageDTO } from "@/features/content/content.types";

// The info page with this slug, or null. A slug that is not in INFO_PAGES gives null without reading any file.
export async function getInfoPage(slug: string): Promise<InfoPageDTO | null> {
  const page = INFO_PAGES.find((candidate) => candidate.slug === slug);
  if (!page) return null;
  const markdown = await contentRepository.readContentFile(page.slug);
  if (markdown === null) return null;
  return { slug: page.slug, title: page.title, markdown };
}
