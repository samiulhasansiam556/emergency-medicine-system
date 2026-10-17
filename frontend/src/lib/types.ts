export interface AvailableMedicine {
  medicine: {
    _id: string;
    name: string;
    genericName: string;
    strength: string;
    dosageForm: string;
  };
  status: "AVAILABLE" | "LOW" | "OUT_OF_STOCK";
  lastStockUpdatedAt: string;
  minutesSinceUpdate: number;
}

export interface NearbyPharmacy {
  pharmacy: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    imageUrl?: string;
    location: { latitude: number; longitude: number };
  };
  distanceKm: number;
  available: AvailableMedicine[];
}

export interface SearchResponse {
  success: boolean;
  radiusKm: number;
  count: number;
  data: NearbyPharmacy[];
  message?: string;
}

export type Role = "USER" | "PHARMACY_OWNER" | "ADMIN";
export type StockStatus = "AVAILABLE" | "LOW" | "OUT_OF_STOCK";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface OwnedPharmacy {
  _id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
}

export interface Medicine {
  _id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category?: string;
}

export interface InventoryItem {
  inventoryId: string;
  medicine: Medicine | null;
  quantity: number;
  reorderLevel: number;
  status: StockStatus;
  lastStockUpdatedAt: string;
}

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export interface RiskItem {
  id: string;
  pharmacy: { id: string; name: string } | null;
  medicine: {
    id: string;
    name: string;
    genericName: string;
    strength: string;
    dosageForm: string;
    category: string | null;
  } | null;
  riskLevel: RiskLevel;
  probability: number | null;
  baselineFlag: boolean | null;
  asOfDate: string;
  predictedForDate: string;
  stockEnd: number | null;
  reorderLevel: number | null;
  avgDemand7d: number | null;
  daysOfStockLeft: number | null;
  demandTrend: number | null;
  reasons: string[];
}

export interface RiskSummary {
  available: boolean;
  asOfDate?: string;
  predictedForDate?: string;
  counts: Record<RiskLevel, number>;
  total: number;
  baselineAlerts: number;
  model?: {
    version: string;
    name?: string;
    trainedUntil?: string;
    metrics?: {
      precision: number;
      recall: number;
      f1: number;
      prAuc: number;
      rocAuc: number;
      baselineF1: number;
    };
  };
}

export interface RiskList {
  available: boolean;
  asOfDate?: string;
  predictedForDate?: string;
  page: number;
  limit: number;
  total: number;
  data: RiskItem[];
}