import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stack } from "@/shared/layout/Stack";
import { Divider } from "@/shared/ui/Divider";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { CategoryForm } from "@/features/categories/components/admin/CategoryForm";
import { DeleteCategoryButton } from "@/features/categories/components/admin/DeleteCategoryButton";
import { getCategoryById } from "@/features/categories/category.service";

export const metadata: Metadata = {
  title: "Edit category · Theme Store",
  robots: { index: false },
};

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  await requireAdmin();
  const { id } = await params;
  const category = await getCategoryById(id);
  if (!category) notFound();

  return (
    <Stack gap="lg">
      <Heading level={1}>{category.name}</Heading>
      <CategoryForm category={category} />
      <Divider />
      <DeleteCategoryButton categoryId={category.id} />
    </Stack>
  );
}
