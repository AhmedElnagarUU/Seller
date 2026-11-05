import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import type { CategoryAdminListItemDTO } from "@/features/categories/category.types";

type CategoryTableProps = {
  categories: CategoryAdminListItemDTO[];
};

export function CategoryTable({ categories }: CategoryTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Slug</TableHeaderCell>
          <TableHeaderCell>Themes</TableHeaderCell>
          <TableHeaderCell>Sort order</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell>{category.name}</TableCell>
            <TableCell>{category.slug}</TableCell>
            <TableCell>{category.themeCount}</TableCell>
            <TableCell>{category.sortOrder}</TableCell>
            <TableCell>
              <TextLink href={`/admin/categories/${category.id}`}>Edit</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
