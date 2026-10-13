
import mongoose, { Schema, Document, Model } from "mongoose";

export type ShortageRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "INSUFFICIENT_DATA";

export interface IShortagePrediction extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  riskLevel: ShortageRiskLevel;
  shortageProbability?: number;
  predictionDays: number;
  predictedForDate: Date;
  modelName: string;
  modelVersion: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const shortagePredictionSchema = new Schema<IShortagePrediction>(
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
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "INSUFFICIENT_DATA"],
      required: true,
    },
    shortageProbability: {
      type: Number,
      min: 0,
      max: 1,
    },
    predictionDays: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 3,
      validate: {
        validator: Number.isInteger,
        message: "Prediction days must be a whole number",
      },
    },
    predictedForDate: {
      type: Date,
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    modelVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

shortagePredictionSchema.index({
  pharmacyId: 1,
  medicineId: 1,
  generatedAt: -1,
});

const ShortagePrediction: Model<IShortagePrediction> =
  (mongoose.models.ShortagePrediction as
    | Model<IShortagePrediction>
    | undefined) ??
  mongoose.model<IShortagePrediction>(
    "ShortagePrediction",
    shortagePredictionSchema
  );

export default ShortagePrediction;
