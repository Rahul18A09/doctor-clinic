import assert from "node:assert/strict";

import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models/user.model";

function passwordAlgorithm(password: string | undefined): string {
  if (!password) {
    return "(missing)";
  }
  const algorithm = password.split("$")[0];
  return algorithm && algorithm.length > 0 ? algorithm : "(unknown)";
}

async function main(): Promise<void> {
  await connectDatabase();

  const rawBefore = await User.collection.findOne({});
  if (!rawBefore) {
    throw new Error("No documents found in collection 'users'.");
  }

  const user = await User.findById(rawBefore._id).lean().exec();
  if (!user) {
    throw new Error(`Mongoose could not read user ${String(rawBefore._id)}.`);
  }

  const rawAfter = await User.collection.findOne({ _id: rawBefore._id });
  assert.deepEqual(rawAfter, rawBefore, "Read path modified the MongoDB document.");

  console.log("Read existing user from collection 'users' (no writes).");
  console.log(
    JSON.stringify(
      {
        collection: User.collection.collectionName,
        id: String(user._id),
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        is_deleted: user.is_deleted,
        mobile: user.mobile ?? null,
        gender: user.gender ?? null,
        last_login: user.last_login ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at,
        password_algorithm: passwordAlgorithm(user.password),
        password_length: user.password?.length ?? 0,
        document_unchanged: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to read existing user: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
