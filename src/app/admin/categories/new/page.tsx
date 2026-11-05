import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { CategoryForm } from "@/features/categories/components/admin/CategoryForm";

export const metadata: Metadata = {
  title: "New category · Theme Store",
  robots: { index: false },
};

export default async function NewCategoryPage() {
  await requireAdmin();

  return (
    <Stack>
      <Heading level={1}>New category</Heading>
      <CategoryForm />
    </Stack>
  );
}
