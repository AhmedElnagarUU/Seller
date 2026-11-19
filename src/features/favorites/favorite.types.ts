import type { ThemeCardDTO } from "@/features/themes/theme.types";

// A category a customer follows.
export type FollowedCategoryDTO = { id: string; name: string; slug: string };

// Everything the favorites page shows.
export type FavoritesDTO = { themes: ThemeCardDTO[]; categories: FollowedCategoryDTO[] };
