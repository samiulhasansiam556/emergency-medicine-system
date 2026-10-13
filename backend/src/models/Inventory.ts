
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInventory extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  quantity: number;
  reorderLevel: number;
  lastUpdatedBy: mongoose.Types.ObjectId;
  lastStockUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
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
      default: 20,
    },

    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    lastStockUpdatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One inventory record per pharmacy and medicine.
inventorySchema.index(
  { pharmacyId: 1, medicineId: 1 },
  { unique: true }
);

const Inventory: Model<IInventory> =
  (mongoose.models.Inventory as Model<IInventory> | undefined) ??
  mongoose.model<IInventory>("Inventory", inventorySchema);

export default Inventory;
