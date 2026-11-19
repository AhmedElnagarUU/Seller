import { describe, expect, it } from "vitest";
import { withTransaction } from "@/shared/db/transaction";
import { createTheme, createUser } from "@/shared/test/factories";
import { OrderModel } from "@/features/orders/order.model";
import { recordWalletOrder } from "@/features/orders/order-wallet.service";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { ThemeModel } from "@/features/themes/theme.model";

const PAID_AT = new Date("2026-11-01T10:00:00Z");
const WALLET_PAYMENT_ID = "665f1c2e8f1b2c3d4e5f6a7b";

describe("recordWalletOrder", () => {
  it("inserts the order with the amounts above and grants the ownership (inside withTransaction)", async () => {
    const theme = await createTheme({ status: "published" });
    const user = await createUser({ country: "EG" });
    const themeId = theme._id.toString();
    const userId = user._id.toString();

    const result = await withTransaction((session) =>
      recordWalletOrder(
        {
          walletPaymentId: WALLET_PAYMENT_ID,
          userId,
          themeId,
          themeName: theme.name,
          themeSlug: theme.slug,
          amountEgp: 1114,
          usdPriceCents: 2900,
          exchangeRate: 48,
          couponId: null,
          couponCode: null,
          paidAt: PAID_AT,
        },
        session,
      ),
    );

    const orders = await OrderModel.find().lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]?._id.toString()).toBe(result.orderId);
    expect(orders[0]?.method).toBe("wallet");
    expect(orders[0]?.status).toBe("paid");
    expect(orders[0]?.currency).toBe("egp");
    expect(orders[0]?.totalAmount).toBe(111400);
    expect(orders[0]?.subtotalAmount).toBe(139200);
    expect(orders[0]?.discountAmount).toBe(27800);
    expect(orders[0]?.taxAmount).toBe(0);
    expect(orders[0]?.refundedAmount).toBe(0);
    expect(orders[0]?.refundedAt).toBeNull();
    expect(orders[0]?.couponId).toBeNull();
    expect(orders[0]?.walletPaymentId?.toString()).toBe(WALLET_PAYMENT_ID);
    expect(orders[0]?.themeSnapshot).toEqual({ name: theme.name, slug: theme.slug });
    expect(orders[0]?.provider).toEqual({
      name: "manual_wallet",
      orderId: WALLET_PAYMENT_ID,
      checkoutId: null,
      customerId: null,
    });
    expect(orders[0]?.paidAt).toEqual(PAID_AT);
    const ownerships = await OwnershipModel.find().lean();
    expect(ownerships).toHaveLength(1);
    expect(ownerships[0]?.status).toBe("active");
    expect(ownerships[0]?.source).toBe("purchase");
    expect(ownerships[0]?.orderId?.toString()).toBe(result.orderId);
    expect((await ThemeModel.findById(themeId).lean())?.stats.salesCount).toBe(1);
  });

  it("never gives a negative discount", async () => {
    const theme = await createTheme({ status: "published" });
    const user = await createUser({ country: "EG" });

    await withTransaction((session) =>
      recordWalletOrder(
        {
          walletPaymentId: WALLET_PAYMENT_ID,
          userId: user._id.toString(),
          themeId: theme._id.toString(),
          themeName: theme.name,
          themeSlug: theme.slug,
          amountEgp: 1500,
          usdPriceCents: 2900,
          exchangeRate: 50,
          couponId: null,
          couponCode: null,
          paidAt: PAID_AT,
        },
        session,
      ),
    );

    const order = await OrderModel.findOne().lean();
    expect(order?.subtotalAmount).toBe(145000);
    expect(order?.totalAmount).toBe(150000);
    expect(order?.discountAmount).toBe(0);
  });
});
