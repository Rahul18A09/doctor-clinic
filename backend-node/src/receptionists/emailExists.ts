import { escapeRegex } from "../http/validation";
import { User } from "../models/user.model";

/**
 * Django `email_exists`: iexact match among non-deleted users.
 * Soft-deleted emails are ignored here; the unique index may still reject them on save.
 */
export async function emailExists(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    is_deleted: false,
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const found = await User.findOne(query).select("_id").exec();
  return found !== null;
}
