import { Schema, model, type HydratedDocument } from "mongoose";

import { GENDERS, USER_ROLES, UserRole, type Gender } from "../constants";

/**
 * Mirrors Django/MongoEngine `apps.users.documents.User`.
 * Collection and field names stay identical so existing Atlas documents can be read as-is.
 */
export interface IUser {
  full_name: string;
  email: string;
  password: string;
  mobile?: string;
  gender?: Gender;
  role: UserRole;
  is_active: boolean;
  is_deleted: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    full_name: { type: String, required: true, maxlength: 255 },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, maxlength: 256 },
    mobile: { type: String, maxlength: 20 },
    gender: { type: String, enum: GENDERS },
    role: {
      type: String,
      required: true,
      enum: USER_ROLES,
      default: UserRole.RECEPTIONIST,
    },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    last_login: { type: Date },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "users",
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
    strict: true,
  },
);

// Matches MongoEngine meta indexes plus EmailField(unique=True).
// autoIndex is false: these are declarations only and are not applied at runtime.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ is_deleted: 1 });

userSchema.virtual("pk").get(function (this: UserDocument): string {
  return String(this._id);
});

userSchema.virtual("is_admin").get(function (this: UserDocument): boolean {
  return this.role === UserRole.ADMIN;
});

userSchema.virtual("is_receptionist").get(function (this: UserDocument): boolean {
  return this.role === UserRole.RECEPTIONIST;
});

userSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type UserDocument = HydratedDocument<IUser>;

export const User = model<IUser>("User", userSchema);
