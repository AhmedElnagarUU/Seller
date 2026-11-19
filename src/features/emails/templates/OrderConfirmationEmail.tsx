import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";
import type { OrderEmailDTO } from "@/features/orders/order.types";

type OrderConfirmationEmailProps = {
  name: string;
  order: OrderEmailDTO;
};

export function OrderConfirmationEmail({ name, order }: OrderConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Thank you for buying ${order.themeName}.`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for buying <strong>{order.themeName}</strong>. It is now in your account, with free updates for life.
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        {`Order: ${order.id} · Date: ${formatDate(order.paidAt)} · Paid: ${formatPrice(order.totalAmount, order.currency)}`}
      </Text>
      {order.discountAmount > 0 ? (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          {`Coupon ${order.couponCode ?? ""}: −${formatPrice(order.discountAmount, order.currency)}`}
        </Text>
      ) : null}
      <Section>
        <Button href={env.APP_URL + "/account/themes"} style={EMAIL_BUTTON_STYLE}>
          Download your theme
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Your receipt from our payment partner Polar was sent in a separate email.
      </Text>
    </EmailLayout>
  );
}
