import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { CategoryTable } from "@/features/categories/components/admin/CategoryTable";
import { listCategoriesForAdmin } from "@/features/categories/category.service";

export const metadata: Metadata = {
  title: "Categories · Theme Store",
  robots: { index: false },
};

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await listCategoriesForAdmin();

  return (
    <Stack>
      <Inline justify="between">
        <Heading level={1}>Categories</Heading>
        <ButtonLink href="/admin/categories/new">New category</ButtonLink>
      </Inline>
      {categories.length > 0 ? <CategoryTable categories={categories} /> : <Text>No categories yet.</Text>}
    </Stack>
  );
}
