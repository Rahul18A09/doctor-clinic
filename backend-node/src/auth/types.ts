import type { UserRole } from "../constants";

export type AuthenticatedUser = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_deleted: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
