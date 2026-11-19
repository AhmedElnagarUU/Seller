import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  ORDER_CURRENCIES,
  ORDER_METHODS,
  ORDER_PROVIDER_NAMES,
  ORDER_STATUSES,
} from "@/features/orders/order.constants";

// The name and slug of the theme when it was bought. They do not change when the theme is renamed.
const themeSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// Link to the payment provider's order.
const providerSchema = new Schema(
  {
    name: { type: String, required: true, enum: ORDER_PROVIDER_NAMES },
    // Polar order id. For a wallet order: the wallet payment id as text. Unique per provider.
    orderId: { type: String, required: true, trim: true },
    // Polar checkout id (the success page finds the order with it).
    checkoutId: { type: String, default: null, trim: true },
    customerId: { type: String, default: null, trim: true },
  },
  { _id: false },
);

// Integer amount in the minor unit of the order currency.
const amount = (defaultValue?: number) => ({
  type: Number,
  required: true,
  min: 0,
  validate: Number.isInteger,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});

// One successful payment for one theme (docs/03-data-model.md section 7).
const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    themeSnapshot: { type: themeSnapshotSchema, required: true },
    method: { type: String, required: true, enum: ORDER_METHODS },
    status: { type: String, required: true, enum: ORDER_STATUSES },
    // "usd" for card, "egp" for wallet.
    currency: { type: String, required: true, enum: ORDER_CURRENCIES },
    // Before the discount.
    subtotalAmount: amount(),
    discountAmount: amount(0),
    taxAmount: amount(0),
    // What the customer paid.
    totalAmount: amount(),
    refundedAmount: amount(0),
    // Can point to a coupon that was deleted later (D-018).
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
    // Copy of the code that was used.
    couponCode: { type: String, default: null, trim: true },
    // Required when method is "wallet".
    walletPaymentId: { type: Schema.Types.ObjectId, ref: "WalletPayment", default: null },
    provider: { type: providerSchema, required: true },
    paidAt: { type: Date, required: true },
    // Set when status becomes "refunded".
    refundedAt: { type: Date, default: null },
  },
  { collection: "orders", timestamps: true },
);

// The same provider order is never saved twice.
orderSchema.index({ "provider.name": 1, "provider.orderId": 1 }, { unique: true });
// The success page finds the order by checkout id.
orderSchema.index({ "provider.checkoutId": 1 });
// "Orders" of a customer.
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
// Dashboard revenue per currency.
orderSchema.index({ currency: 1, paidAt: -1 });
// Top themes.
orderSchema.index({ themeId: 1, paidAt: -1 });

export type OrderRecord = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };

// `models.Order ||` stops hot reload from defining the model twice.
export const OrderModel = (models.Order as Model<OrderRecord>) || model<OrderRecord>("Order", orderSchema);
