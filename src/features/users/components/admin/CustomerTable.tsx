import { formatDate } from "@/shared/lib/dates";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import type { CustomerListItemDTO } from "@/features/users/user.types";

type CustomerTableProps = {
  customers: CustomerListItemDTO[];
};

export function CustomerTable({ customers }: CustomerTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Email</TableHeaderCell>
          <TableHeaderCell>Country</TableHeaderCell>
          <TableHeaderCell>Themes owned</TableHeaderCell>
          <TableHeaderCell>Joined</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <TextLink href={`/admin/customers/${customer.id}`}>{customer.name}</TextLink>
            </TableCell>
            <TableCell>{customer.email}</TableCell>
            <TableCell>{customer.country ?? "—"}</TableCell>
            <TableCell>{customer.ownedCount}</TableCell>
            <TableCell>{formatDate(customer.createdAt)}</TableCell>
            <TableCell>
              <Badge tone={customer.isDisabled ? "danger" : "success"}>
                {customer.isDisabled ? "Disabled" : "Active"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
