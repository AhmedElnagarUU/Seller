import { MongoMemoryReplSet } from "mongodb-memory-server";

let replicaSet: MongoMemoryReplSet | null = null;

export async function setup(): Promise<void> {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replicaSet.getUri("themestore-test");
}

export async function teardown(): Promise<void> {
  await replicaSet?.stop();
}
