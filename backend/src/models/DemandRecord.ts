import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDemandRecord extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  requestedQuantity: number;
  fulfilledQuantity: number;
  unmetQuantity: number;
  recordedBy?: mongoose.Types.ObjectId;
  source: "PHARMACY" | "USER_REPORT";
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const demandRecordSchema = new Schema<IDemandRecord>(
  {
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true,
    },

    medicineId: {
      type: Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
      index: true,
    },

    requestedQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Requested quantity must be a whole number",
      },
    },

    fulfilledQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Fulfilled quantity must be a whole number",
      },
    },

    unmetQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Unmet quantity must be a whole number",
      },
    },

    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    source: {
      type: String,
      enum: ["PHARMACY", "USER_REPORT"],
      required: true,
      default: "PHARMACY",
    },

    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

demandRecordSchema.index({
  pharmacyId: 1,
  medicineId: 1,
  recordedAt: -1,
});

const DemandRecord: Model<IDemandRecord> =
  (mongoose.models.DemandRecord as Model<IDemandRecord> | undefined) ??
  mongoose.model<IDemandRecord>("DemandRecord", demandRecordSchema);

export default DemandRecord;
