import { toDjangoIso } from "../auth/iso";

export type SerializedReceptionist = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  gender: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

/** Matches Django `ReceptionistSerializer.to_representation`. */
export function serializeReceptionist(user: {
  _id?: { toString(): string };
  id?: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  gender?: string | null;
  is_active: boolean;
  created_at?: Date | null;
  updated_at?: Date | null;
}): SerializedReceptionist {
  return {
    id: user.id ?? String(user._id),
    full_name: user.full_name,
    email: user.email,
    mobile: user.mobile ?? "",
    gender: user.gender ?? "",
    is_active: user.is_active,
    created_at: toDjangoIso(user.created_at),
    updated_at: toDjangoIso(user.updated_at),
  };
}
