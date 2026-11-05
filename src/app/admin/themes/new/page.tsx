import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { listCategoriesForAdmin } from "@/features/categories/category.service";
import { ThemeForm } from "@/features/themes/components/admin/ThemeForm";

export const metadata: Metadata = {
  title: "New theme · Theme Store",
  robots: { index: false },
};

export default async function NewThemePage() {
  await requireAdmin();
  const categories = await listCategoriesForAdmin();
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));

  return (
    <Stack>
      <Heading level={1}>New theme</Heading>
      <ThemeForm categoryOptions={categoryOptions} />
    </Stack>
  );
}
