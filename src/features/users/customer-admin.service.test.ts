import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { getCustomerForAdmin } from "@/features/users/customer-admin.service";
import {
  createActivityLog,
  createFeedback,
  createOrder,
  createOwnership,
  createTheme,
  createUser,
  createWalletPayment,
} from "@/shared/test/factories";

const EARLIER = new Date("2026-10-01T10:00:00Z");
const LATER = new Date("2026-10-02T10:00:00Z");
const JOINED = new Date("2026-09-01T10:00:00Z");

describe("getCustomerForAdmin", () => {
  it("returns the customer's own data only", async () => {
    const customer = await createUser({
      name: "Ann Lee",
      email: "ann@example.com",
      country: "EG",
      emailVerified: true,
      createdAt: JOINED,
    });
    const other = await createUser();
    const customerId = customer._id.toString();
    const zeta = await createTheme({ name: "Zeta Blog" });
    const alpha = await createTheme({ name: "Alpha Shop" });
    const lost = await createTheme({ name: "Lost Theme" });
    await createOwnership(customerId, zeta._id.toString(), { grantNote: "Beta tester" });
    const order = await createOrder({ userId: customer._id, themeId: alpha._id });
    await createOwnership(customerId, alpha._id.toString(), { source: "purchase", orderId: order._id });
    await createOwnership(customerId, lost._id.toString(), {
      status: "revoked",
      revokedAt: EARLIER,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Abuse",
    });
    await createOrder({ userId: other._id });
    const payment = await createWalletPayment({ userId: customer._id, themeId: zeta._id });
    await createWalletPayment({ userId: other._id });
    const feedback = await createFeedback(customerId, { subject: "My question" });
    await createFeedback(other._id.toString(), { subject: "Not mine" });
    const older = await createActivityLog({
      action: "feedback_sent",
      actorRole: "customer",
      actorUserId: customer._id,
      subjectUserId: customer._id,
      summary: "Older row",
      createdAt: EARLIER,
    });
    const newer = await createActivityLog({
      action: "order_paid",
      subjectUserId: customer._id,
      summary: "Newer row",
      createdAt: LATER,
    });
    await createActivityLog({ subjectUserId: other._id, summary: "Someone else" });

    const page = await getCustomerForAdmin(customerId);

    expect(page?.customer).toEqual({
      id: customerId,
      name: "Ann Lee",
      email: "ann@example.com",
      emailVerified: true,
      country: "EG",
      createdAt: JOINED,
      isDisabled: false,
      disabledReason: null,
      disabledAt: null,
    });
    expect(page?.ownerships).toEqual([
      { themeId: alpha._id.toString(), themeName: "Alpha Shop", source: "purchase", grantNote: null },
      { themeId: zeta._id.toString(), themeName: "Zeta Blog", source: "admin_grant", grantNote: "Beta tester" },
    ]);
    expect(page?.orders).toEqual([
      {
        id: order._id.toString(),
        themeName: alpha.name,
        method: "card",
        currency: "usd",
        totalAmount: 2900,
        status: "paid",
        paidAt: order.paidAt,
      },
    ]);
    expect(page?.walletPayments).toEqual([
      {
        id: payment._id.toString(),
        themeName: zeta.name,
        amountEgp: payment.amountEgp,
        referenceCode: payment.referenceCode,
        status: "awaiting_payment",
      },
    ]);
    expect(page?.feedback).toEqual([
      { id: feedback._id.toString(), subject: "My question", status: "new", createdAt: feedback.createdAt },
    ]);
    expect(page?.activity).toEqual([
      { id: newer._id.toString(), createdAt: LATER, summary: "Newer row" },
      { id: older._id.toString(), createdAt: EARLIER, summary: "Older row" },
    ]);
  });

  it("returns the disabled flags of a disabled customer", async () => {
    const disabledAt = new Date("2026-10-05T10:00:00Z");
    const customer = await createUser({ disabled: true, disabledReason: "Spam", disabledAt });

    const page = await getCustomerForAdmin(customer._id.toString());

    expect(page?.customer.isDisabled).toBe(true);
    expect(page?.customer.disabledReason).toBe("Spam");
    expect(page?.customer.disabledAt).toEqual(disabledAt);
  });

  it("returns null for an unknown and an invalid id", async () => {
    expect(await getCustomerForAdmin(new Types.ObjectId().toString())).toBeNull();
    expect(await getCustomerForAdmin("not-an-id")).toBeNull();
  });
});
