import { Schema, model, type HydratedDocument } from "mongoose";

import { BED_STATUSES, BedStatus } from "../constants";

export interface IBed {
  room_id: string;
  bed_number: string;
  status: BedStatus;
  patient_id?: string | null;
  assigned_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const bedSchema = new Schema<IBed>(
  {
    room_id: { type: String, required: true },
    bed_number: { type: String, required: true, maxlength: 20 },
    status: {
      type: String,
      required: true,
      enum: BED_STATUSES,
      default: BedStatus.AVAILABLE,
    },
    patient_id: { type: String, default: null },
    assigned_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "beds",
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
  },
);

bedSchema.index({ room_id: 1, bed_number: 1 }, { unique: true });
bedSchema.index({ room_id: 1, status: 1 });
bedSchema.index({ status: 1 });
bedSchema.index(
  { patient_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      patient_id: { $type: "string", $gt: "" },
      status: { $in: [BedStatus.OCCUPIED, BedStatus.RESERVED] },
    },
  },
);

bedSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type BedDocument = HydratedDocument<IBed>;

export const Bed = model<IBed>("Bed", bedSchema);
