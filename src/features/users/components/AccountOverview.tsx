import { Grid } from "@/shared/layout/Grid";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatDate } from "@/shared/lib/dates";
import { Alert } from "@/shared/ui/Alert";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { ThemeCard } from "@/features/themes/components/ThemeCard";
import type { AccountOverviewDTO } from "@/features/users/account.types";

type AccountOverviewProps = {
  name: string;
  emailVerified: boolean;
  overview: AccountOverviewDTO;
};

type StatCardProps = { label: string; value: number };

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <Stack gap="xs">
        <Text tone="muted">{label}</Text>
        <Text size="lg" weight="bold">
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

export function AccountOverview({ name, emailVerified, overview }: AccountOverviewProps) {
  return (
    <Stack gap="lg">
      <Heading level={1}>Hi {name}</Heading>
      {emailVerified ? null : (
        <Alert tone="warning">
          Please confirm your email address. <TextLink href="/verify-email">Confirm email</TextLink>
        </Alert>
      )}
      <Grid columns={3}>
        <StatCard label="Themes owned" value={overview.ownedCount} />
        <StatCard label="Unread notifications" value={overview.unreadCount} />
        {overview.openWalletPayments !== null ? (
          <StatCard label="Wallet payments waiting" value={overview.openWalletPayments} />
        ) : null}
      </Grid>
      <Stack>
        <Inline justify="between" wrap>
          <Heading level={2}>Latest notifications</Heading>
          <TextLink href="/account/notifications">See all</TextLink>
        </Inline>
        {overview.latestNotifications.length === 0 ? <Text>No notifications yet.</Text> : null}
        {overview.latestNotifications.map((notification) => (
          <Card key={notification.id}>
            <Stack gap="xs">
              <Inline gap="sm">
                <Text weight="bold">{notification.title}</Text>
                {notification.isRead ? null : <Badge tone="primary">New</Badge>}
              </Inline>
              <Text size="sm" tone="muted">
                {notification.body}
              </Text>
              <Text size="sm" tone="muted">
                {formatDate(notification.createdAt)}
              </Text>
            </Stack>
          </Card>
        ))}
      </Stack>
      {overview.bestSellers.length > 0 ? (
        <Stack>
          <Heading level={2}>Best sellers</Heading>
          <Grid columns={4}>
            {overview.bestSellers.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </Grid>
        </Stack>
      ) : null}
      {overview.openWalletPayments !== null ? (
        <Card>
          <Stack gap="sm">
            <Heading level={3}>Pay with Vodafone Cash or InstaPay</Heading>
            <Text>
              You can pay with an Egyptian wallet on every checkout page. Choose “Egyptian wallet”, send the amount,
              then upload a screenshot of the transfer.
            </Text>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
