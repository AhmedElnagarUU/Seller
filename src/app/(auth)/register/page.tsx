import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { getCountryOptions, isCountryCode } from "@/shared/lib/countries";
import { Card } from "@/shared/ui/Card";
import { Divider } from "@/shared/ui/Divider";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { getCurrentUser } from "@/features/auth/session";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  const detectedCountry = (await headers()).get("cf-ipcountry") ?? "";
  const defaultCountry = isCountryCode(detectedCountry) ? detectedCountry : "";

  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <Stack gap="lg">
          <Heading level={1}>Create your account</Heading>
          <RegisterForm countryOptions={getCountryOptions()} defaultCountry={defaultCountry} />
          <Divider label="or" />
          <GoogleButton />
          <Text size="sm" tone="muted">
            Already have an account? <TextLink href="/login">Log in</TextLink>
          </Text>
        </Stack>
      </Card>
    </PageContainer>
  );
}
