import { Stack } from "@/shared/layout/Stack";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { RevokeOwnershipForm } from "@/features/ownerships/components/admin/RevokeOwnershipForm";
import type { OwnershipAdminRowDTO } from "@/features/ownerships/ownership.types";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";

type CustomerOwnedThemesProps = {
  customerId: string;
  ownerships: OwnershipAdminRowDTO[];
};

const SOURCE_LABELS = { purchase: "Purchase", admin_grant: "Admin grant" } as const;

export function CustomerOwnedThemes({ customerId, ownerships }: CustomerOwnedThemesProps) {
  if (ownerships.length === 0) return <Text>{CUSTOMER_MESSAGES.noThemes}</Text>;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Theme</TableHeaderCell>
          <TableHeaderCell>Source</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ownerships.map((ownership) => (
          <TableRow key={ownership.themeId}>
            <TableCell>
              <TextLink href={`/admin/themes/${ownership.themeId}`}>{ownership.themeName}</TextLink>
            </TableCell>
            <TableCell>
              <Stack gap="xs">
                <Text>{SOURCE_LABELS[ownership.source]}</Text>
                {ownership.grantNote ? (
                  <Text size="sm" tone="muted">
                    {ownership.grantNote}
                  </Text>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>
              <RevokeOwnershipForm userId={customerId} themeId={ownership.themeId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
