import type { AuthenticatedUser } from "../auth/types";
import { User } from "../models/user.model";

export async function findUserForAuth(userId: string): Promise<AuthenticatedUser | null> {
  try {
    const user = await User.findById(userId)
      .select("full_name email role is_active is_deleted")
      .lean()
      .exec();

    if (!user) {
      return null;
    }

    return {
      id: String(user._id),
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active !== false,
      is_deleted: user.is_deleted === true,
    };
  } catch {
    return null;
  }
}
