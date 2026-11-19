import type { InfoPageSlug } from "@/features/content/content.constants";

export type InfoPageDTO = {
  slug: InfoPageSlug;
  title: string;
  markdown: string;
};
