import { notFound } from "next/navigation";
import { env } from "@/shared/config/env";
import { Grid } from "@/shared/layout/Grid";
import { Inline } from "@/shared/layout/Inline";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ButtonAnchor } from "@/shared/ui/ButtonAnchor";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Card } from "@/shared/ui/Card";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Divider } from "@/shared/ui/Divider";
import { FormError } from "@/shared/ui/FormError";
import { Heading } from "@/shared/ui/Heading";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { TextLink } from "@/shared/ui/TextLink";

const COUNTRY_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "eg", label: "Egypt" },
];

export default function UiKitPage() {
  if (env.NODE_ENV === "production") notFound();

  return (
    <PageContainer width="wide">
      <Stack gap="xl">
        <Heading level={1}>UI kit</Heading>

        <Stack>
          <Heading level={2}>Buttons</Heading>
          <Inline wrap>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </Inline>
          <Inline wrap>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
          </Inline>
          <Inline wrap>
            <ButtonLink href="/">Button link</ButtonLink>
            <ButtonAnchor href="/" variant="secondary">
              Button anchor
            </ButtonAnchor>
            <form>
              <SubmitButton pendingText="Saving...">Submit</SubmitButton>
            </form>
          </Inline>
          <Button fullWidth>Full width</Button>
        </Stack>

        <Stack>
          <Heading level={2}>Text</Heading>
          <Heading level={1}>Heading 1</Heading>
          <Heading level={2}>Heading 2</Heading>
          <Heading level={3}>Heading 3</Heading>
          <Text size="sm">Small text</Text>
          <Text size="md">Medium text</Text>
          <Text size="lg">Large text</Text>
          <Text tone="muted">Muted text</Text>
          <Text tone="danger">Danger text</Text>
          <Text tone="success">Success text</Text>
          <Text weight="bold">Bold text</Text>
          <Text as="span">Span text</Text>
          <TextLink href="/">Primary link</TextLink>
          <TextLink href="/" tone="muted">
            Muted link
          </TextLink>
          <Divider />
          <Divider label="or" />
        </Stack>

        <Stack>
          <Heading level={2}>Badges</Heading>
          <Inline wrap>
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
          </Inline>
        </Stack>

        <Stack>
          <Heading level={2}>Alerts</Heading>
          <Alert tone="info" title="Info title">
            Something to know.
          </Alert>
          <Alert tone="success">It worked.</Alert>
          <Alert tone="warning">Be careful.</Alert>
          <Alert tone="danger">Something went wrong.</Alert>
          <FormError message="Form level error." />
          <FormError message={null} />
        </Stack>

        <Stack>
          <Heading level={2}>Form fields</Heading>
          <Card padding="lg">
            <Stack>
              <TextField label="Email" name="email" type="email" errors={["Enter a valid email."]} />
              <TextField label="Name" name="name" hint="As shown on your invoice." placeholder="Jane Doe" />
              <TextAreaField label="Message" name="message" />
              <SelectField label="Country" name="country" options={COUNTRY_OPTIONS} placeholder="Choose a country" />
              <CheckboxField label="Remember me" name="remember" hint="Only on this device." />
            </Stack>
          </Card>
        </Stack>

        <Stack>
          <Heading level={2}>Cards</Heading>
          <Grid columns={3}>
            <Card>
              <Text>Card with medium padding</Text>
            </Card>
            <Card padding="lg">
              <Text>Card with large padding</Text>
            </Card>
            <Card>
              <Text tone="muted">Third card</Text>
            </Card>
          </Grid>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
