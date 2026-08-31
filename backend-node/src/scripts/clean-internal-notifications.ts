import { connectDatabase, disconnectDatabase } from "../config/database";
import { deleteInternalNotifications } from "../notifications/cleanup";

async function main(): Promise<void> {
  await connectDatabase();
  const deleted = await deleteInternalNotifications();
  console.log(`Deleted ${deleted} internal/test notification(s).`);
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
