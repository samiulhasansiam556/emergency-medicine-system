import mongoose, { Schema, Document, Model } from "mongoose";

export type ShortageRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "INSUFFICIENT_DATA";

// The numbers behind a prediction, so the dashboard can explain "why".
export interface IPredictionFeatures {
  stockEnd: number;
  reorderLevel: number;
  avgDemand7d: number;
  daysOfStockLeft: number;
  demandTrend: number;
}

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

  // Last day of data the prediction was based on.
  asOfDate?: Date;
  // Would the simple "stock <= reorder level" rule have raised an alert?
  baselineFlag?: boolean;
  features?: IPredictionFeatures;

  // Filled in later, once the next 3 days have passed.
  actualStockout?: boolean;
  evaluatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const featuresSchema = new Schema<IPredictionFeatures>(
  {
    stockEnd: { type: Number, required: true },
    reorderLevel: { type: Number, required: true },
    avgDemand7d: { type: Number, required: true },
    daysOfStockLeft: { type: Number, required: true },
    demandTrend: { type: Number, required: true },
  },
  { _id: false }
);

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

    asOfDate: { type: Date },
    baselineFlag: { type: Boolean },
    features: { type: featuresSchema },
    actualStockout: { type: Boolean },
    evaluatedAt: { type: Date },
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

// One prediction per item, per day, per model version.
// Only applies to predictions that have an asOfDate (older test records are ignored).
shortagePredictionSchema.index(
  { pharmacyId: 1, medicineId: 1, asOfDate: 1, modelVersion: 1 },
  { unique: true, partialFilterExpression: { asOfDate: { $type: "date" } } }
);

// For dashboards: "all HIGH risk items for a day".
shortagePredictionSchema.index({ asOfDate: -1, riskLevel: 1 });

const ShortagePrediction: Model<IShortagePrediction> =
  (mongoose.models.ShortagePrediction as
    | Model<IShortagePrediction>
    | undefined) ??
  mongoose.model<IShortagePrediction>(
    "ShortagePrediction",
    shortagePredictionSchema
  );

export default ShortagePrediction;