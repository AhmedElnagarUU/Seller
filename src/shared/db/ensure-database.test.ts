import { readdirSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { ensureDatabase } from "@/shared/db/ensure-database";
import { ALL_MODELS } from "@/shared/db/models";

async function listCollectionNames(): Promise<string[]> {
  const collections = await mongoose.connection.db?.listCollections().toArray();
  return (collections ?? []).map((collection) => collection.name).sort();
}

describe("ensureDatabase", () => {
  it("creates the Better Auth collections and every model collection on an empty database", async () => {
    await mongoose.connection.dropDatabase();
    expect(await listCollectionNames()).toEqual([]);

    await ensureDatabase();

    const names = await listCollectionNames();
    for (const name of ["user", "session", "account", "verification"]) expect(names).toContain(name);
    for (const model of ALL_MODELS) expect(names).toContain(model.collection.collectionName);
  });

  it("builds the indexes of the models", async () => {
    await mongoose.connection.dropDatabase();

    await ensureDatabase();

    const themeIndexes = await ThemeModel.collection.indexes();
    const slugIndex = themeIndexes.find((index) => index.key.slug === 1);
    expect(slugIndex?.unique).toBe(true);
    const activityIndexes = await ActivityLogModel.collection.indexes();
    const ttlIndex = activityIndexes.find((index) => index.key.createdAt === 1);
    expect(ttlIndex?.expireAfterSeconds).toBeTypeOf("number");
  });

  it("can run twice", async () => {
    await ensureDatabase();
    const namesBefore = await listCollectionNames();
    const indexesBefore = await ThemeModel.collection.indexes();

    await expect(ensureDatabase()).resolves.toBeUndefined();

    expect(await listCollectionNames()).toEqual(namesBefore);
    expect(await ThemeModel.collection.indexes()).toEqual(indexesBefore);
  });
});

describe("ALL_MODELS", () => {
  it("lists every model file", () => {
    const featuresFolder = path.join(process.cwd(), "src", "features");
    const modelFiles = readdirSync(featuresFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => readdirSync(path.join(featuresFolder, entry.name)))
      .filter((fileName) => fileName.endsWith(".model.ts"));

    expect(modelFiles.length).toBeGreaterThan(0);
    expect(ALL_MODELS.length).toBe(modelFiles.length);
  });
});
