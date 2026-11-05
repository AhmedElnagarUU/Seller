export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type CategoryAdminDTO = CategoryDTO & {
  sortOrder: number;
};

export type CategoryAdminListItemDTO = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  themeCount: number;
};

export type CategoryWithCountDTO = {
  name: string;
  slug: string;
  themeCount: number;
};
