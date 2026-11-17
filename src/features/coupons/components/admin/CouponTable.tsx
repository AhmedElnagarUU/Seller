import { formatDate } from "@/shared/lib/dates";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import type { CouponListItemDTO } from "@/features/coupons/coupon.types";

type CouponTableProps = {
  coupons: CouponListItemDTO[];
};

export function CouponTable({ coupons }: CouponTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Code</TableHeaderCell>
          <TableHeaderCell>Discount</TableHeaderCell>
          <TableHeaderCell>Themes</TableHeaderCell>
          <TableHeaderCell>Used / limit</TableHeaderCell>
          <TableHeaderCell>Expires</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {coupons.map((coupon) => (
          <TableRow key={coupon.id}>
            <TableCell>{coupon.code}</TableCell>
            <TableCell>{coupon.discountLabel}</TableCell>
            <TableCell>{coupon.themesLabel}</TableCell>
            <TableCell>
              {coupon.redemptionsCount} / {coupon.maxRedemptions ?? "Unlimited"}
            </TableCell>
            <TableCell>{coupon.expiresAt ? formatDate(coupon.expiresAt) : "Never"}</TableCell>
            <TableCell>
              <Badge tone={coupon.active ? "success" : "neutral"}>{coupon.active ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>
              <TextLink href={`/admin/coupons/${coupon.id}`}>Edit</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
