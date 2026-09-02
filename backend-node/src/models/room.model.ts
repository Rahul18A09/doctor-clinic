import { Schema, model, type HydratedDocument } from "mongoose";

import { ROOM_TYPES, RoomType } from "../constants";

export interface IRoom {
  room_number: string;
  room_type: RoomType;
  floor: string;
  capacity: number;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    room_number: { type: String, required: true, maxlength: 50 },
    room_type: { type: String, required: true, enum: ROOM_TYPES, default: RoomType.GENERAL },
    floor: { type: String, required: true, maxlength: 50 },
    capacity: { type: Number, required: true, min: 1, max: 200 },
    notes: { type: String, default: "", maxlength: 1000 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "rooms",
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
  },
);

roomSchema.index({ room_number: 1 }, { unique: true });
roomSchema.index({ room_type: 1 });
roomSchema.index({ floor: 1 });

roomSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type RoomDocument = HydratedDocument<IRoom>;

export const Room = model<IRoom>("Room", roomSchema);
