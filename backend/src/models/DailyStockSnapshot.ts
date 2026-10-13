
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDailyStockSnapshot extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  date: Date;
  quantity: number;
  reorderLevel: number;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyStockSnapshotSchema = new Schema<IDailyStockSnapshot>(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
    reorderLevel: {
      type: Number,
      required: true,
      min: 0,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

dailyStockSnapshotSchema.index(
  { pharmacyId: 1, medicineId: 1, date: 1 },
  { unique: true }
);

const DailyStockSnapshot: Model<IDailyStockSnapshot> =
  (mongoose.models.DailyStockSnapshot as
    | Model<IDailyStockSnapshot>
    | undefined) ??
  mongoose.model<IDailyStockSnapshot>(
    "DailyStockSnapshot",
    dailyStockSnapshotSchema
  );

export default DailyStockSnapshot;
