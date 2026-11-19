export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDatabase } = await import("@/shared/db/ensure-database");
  await ensureDatabase();
}
