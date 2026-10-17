import mongoose, { Schema, Document, Model } from "mongoose";

// One document per trained model version. Written by the ML service
// (predict_batch.py), read by the backend to know which model is active.
export interface IModelRun extends Document {
  version: string;
  modelName: string;
  isActive: boolean;
  trainedUntil?: string;
  horizonDays?: number;
  cutoffs?: { high: number; medium: number };
  metrics?: {
    precision: number;
    recall: number;
    f1: number;
    prAuc: number;
    rocAuc: number;
    baselineF1: number;
  };
  testPeriod?: { start: string; end: string };
  activatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const modelRunSchema = new Schema<IModelRun>(
  {
    version: { type: String, required: true, unique: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false, index: true },
    trainedUntil: { type: String },
    horizonDays: { type: Number },
    cutoffs: { high: { type: Number }, medium: { type: Number } },
    metrics: {
      precision: { type: Number },
      recall: { type: Number },
      f1: { type: Number },
      prAuc: { type: Number },
      rocAuc: { type: Number },
      baselineF1: { type: Number },
    },
    testPeriod: { start: { type: String }, end: { type: String } },
    activatedAt: { type: Date },
  },
  { timestamps: true }
);

const ModelRun: Model<IModelRun> =
  (mongoose.models.ModelRun as Model<IModelRun> | undefined) ??
  mongoose.model<IModelRun>("ModelRun", modelRunSchema);

export default ModelRun;