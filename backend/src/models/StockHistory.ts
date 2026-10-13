
import mongoose, { Schema, Document, Model } from "mongoose";

export type StockMovementType =
  | "INITIAL_STOCK"
  | "SALE"
  | "RESTOCK"
  | "ADJUSTMENT"
  | "EXPIRED"
  | "DAMAGED";

export interface IStockHistory extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  inventoryId: mongoose.Types.ObjectId;
  movementType: StockMovementType;
  quantityChange: number;
  quantityAfter: number;
  recordedBy: mongoose.Types.ObjectId;
  note?: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stockHistorySchema = new Schema<IStockHistory>(
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

    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },

    movementType: {
      type: String,
      enum: [
        "INITIAL_STOCK",
        "SALE",
        "RESTOCK",
        "ADJUSTMENT",
        "EXPIRED",
        "DAMAGED",
      ],
      required: true,
    },

    quantityChange: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Quantity change must be a whole number",
      },
    },

    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity after movement must be a whole number",
      },
    },

    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

stockHistorySchema.index({
  pharmacyId: 1,
  medicineId: 1,
  recordedAt: -1,
});

const StockHistory: Model<IStockHistory> =
  (mongoose.models.StockHistory as Model<IStockHistory> | undefined) ??
  mongoose.model<IStockHistory>("StockHistory", stockHistorySchema);

export default StockHistory;

