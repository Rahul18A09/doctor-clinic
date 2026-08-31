import { toDjangoIso } from "./iso";

export type SerializedUser = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function serializeUser(user: {
  _id?: { toString(): string };
  id?: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  role: string;
  is_active: boolean;
  last_login?: Date | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}): SerializedUser {
  return {
    id: user.id ?? String(user._id),
    full_name: user.full_name,
    email: user.email,
    mobile: user.mobile ?? "",
    role: user.role,
    is_active: user.is_active,
    last_login: toDjangoIso(user.last_login),
    created_at: toDjangoIso(user.created_at),
    updated_at: toDjangoIso(user.updated_at),
  };
}
