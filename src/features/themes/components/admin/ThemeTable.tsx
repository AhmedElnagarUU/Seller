import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { ImageFrame } from "@/shared/ui/ImageFrame";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import { THEME_STATUS_LABELS } from "@/features/themes/theme.constants";
import type { ThemeAdminListItemDTO } from "@/features/themes/theme.types";

type ThemeTableProps = {
  themes: ThemeAdminListItemDTO[];
};

export function ThemeTable({ themes }: ThemeTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Cover</TableHeaderCell>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Price</TableHeaderCell>
          <TableHeaderCell>Version</TableHeaderCell>
          <TableHeaderCell>Sales</TableHeaderCell>
          <TableHeaderCell>Downloads</TableHeaderCell>
          <TableHeaderCell>Updated</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {themes.map((theme) => (
          <TableRow key={theme.id}>
            <TableCell>
              {theme.coverImage ? (
                <div className="w-16">
                  <ImageFrame src={theme.coverImage.url} alt={theme.coverImage.alt} sizes="64px" />
                </div>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>{theme.name}</TableCell>
            <TableCell>
              <Badge>{THEME_STATUS_LABELS[theme.status]}</Badge>
            </TableCell>
            <TableCell>{formatPrice(theme.priceCents, "usd")}</TableCell>
            <TableCell>{theme.latestVersion ?? "—"}</TableCell>
            <TableCell>{theme.salesCount}</TableCell>
            <TableCell>{theme.downloadCount}</TableCell>
            <TableCell>{formatDate(theme.updatedAt)}</TableCell>
            <TableCell>
              <TextLink href={`/admin/themes/${theme.id}`}>Edit</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
