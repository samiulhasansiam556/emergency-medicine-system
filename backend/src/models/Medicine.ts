
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMedicine extends Document {
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer?: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<IMedicine>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    genericName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    strength: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    dosageForm: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "TABLET",
        "CAPSULE",
        "SYRUP",
        "SUSPENSION",
        "INJECTION",
        "CREAM",
        "OINTMENT",
        "DROPS",
        "INHALER",
        "OTHER",
      ],
    },

    manufacturer: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    category: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

medicineSchema.index(
  { name: 1, strength: 1, dosageForm: 1 },
  { unique: true }
);

const Medicine: Model<IMedicine> =
  (mongoose.models.Medicine as Model<IMedicine> | undefined) ??
  mongoose.model<IMedicine>("Medicine", medicineSchema);

export default Medicine;
