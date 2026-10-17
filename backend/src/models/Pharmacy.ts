import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPharmacy extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  imageUrl?: string;
  address: string;
  city: string;
  phone: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  geo?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

const pharmacySchema = new Schema<IPharmacy>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
    },

    geo: {
      type: { type: String, enum: ["Point"] },
      coordinates: {
        type: [Number],
        default: undefined, // important: empty array dile 2dsphere index error dey
        validate: {
          validator: (v: number[]) => v.length === 2,
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);


pharmacySchema.index({ geo: "2dsphere" });


const Pharmacy: Model<IPharmacy> =
  (mongoose.models.Pharmacy as Model<IPharmacy> | undefined) ??
  mongoose.model<IPharmacy>("Pharmacy", pharmacySchema);

export default Pharmacy;
