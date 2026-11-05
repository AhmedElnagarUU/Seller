import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { withTransaction } from "@/shared/db/transaction";

const TransactionProbeModel = mongoose.model(
  "TransactionProbe",
  new mongoose.Schema({ label: { type: String, required: true } }),
);

describe("withTransaction", () => {
  it("rolls back every write when the function throws", async () => {
    await TransactionProbeModel.createCollection();

    await expect(
      withTransaction(async (session) => {
        await TransactionProbeModel.create([{ label: "inside" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrowError("boom");

    expect(await TransactionProbeModel.countDocuments()).toBe(0);
  });

  it("commits when the function succeeds", async () => {
    await TransactionProbeModel.createCollection();

    const result = await withTransaction(async (session) => {
      await TransactionProbeModel.create([{ label: "inside" }], { session });
      return "done";
    });

    expect(result).toBe("done");
    expect(await TransactionProbeModel.countDocuments()).toBe(1);
  });
});
