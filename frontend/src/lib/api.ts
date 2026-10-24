import type {
  AuthUser,
  InventoryItem,
  Medicine,
  OwnedPharmacy,
  SearchResponse,
} from "./types";

import { RiskLevel,RiskList,RiskSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    throw new Error(json.message ?? "Request failed.");
  }
  return json as T;
}

// ---------- Search ----------
export function searchMedicine(params: {
  q: string;
  lat: number;
  lng: number;
  radiusKm: number;
}) {
  const query = new URLSearchParams({
    q: params.q,
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm),
  });
  return request<SearchResponse>(`/api/search/medicines?${query}`);
}

// ---------- Auth ----------
interface AuthResult {
  data: { token: string; user: AuthUser };
}

export function registerRequest(body: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  return request<AuthResult>("/api/auth/register", { method: "POST", body });
}

export function loginRequest(body: { email: string; password: string }) {
  return request<AuthResult>("/api/auth/login", { method: "POST", body });
}

// ---------- Pharmacy ----------
export function getMyPharmacies(token: string) {
  return request<{ data: OwnedPharmacy[] }>("/api/pharmacies/mine", { token });
}

export function createPharmacyRequest(
  token: string,
  body: {
    name: string;
    address: string;
    city: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  }
) {
  return request<{ data: OwnedPharmacy }>("/api/pharmacies", {
    method: "POST",
    body,
    token,
  });
}

// ---------- Medicines ----------
export function searchMedicineCatalog(q: string) {
  return request<{ data: Medicine[] }>(
    `/api/medicines?search=${encodeURIComponent(q)}&limit=10`
  );
}

export function createMedicineRequest(
  token: string,
  body: {
    name: string;
    genericName: string;
    strength: string;
    dosageForm: string;
    category?: string;
  }
) {
  return request<{ data: Medicine }>("/api/medicines", {
    method: "POST",
    body,
    token,
  });
}

// ---------- Inventory ----------
export function listInventory(pharmacyId: string) {
  return request<{ data: InventoryItem[] }>(`/api/inventory/pharmacy/${pharmacyId}`);
}

export function addInventoryRequest(
  token: string,
  body: {
    pharmacyId: string;
    medicineId: string;
    quantity: number;
    reorderLevel: number;
  }
) {
  return request("/api/inventory", { method: "POST", body, token });
}

export function updateStockRequest(
  token: string,
  body: {
    pharmacyId: string;
    medicineId: string;
    movementType: string;
    quantityChange: number;
  }
) {
  return request("/api/inventory/stock", { method: "PATCH", body, token });
}


export function getRiskSummary(token: string, pharmacyId: string) {
  return request<RiskSummary>(`/api/risk/summary?pharmacyId=${pharmacyId}`, { token });
}

export function getRiskList(
  token: string,
  params: {
    pharmacyId: string;
    level?: RiskLevel;
    search?: string;
    sort: "risk" | "days";
    page: number;
    limit: number;
  }
) {
  const query = new URLSearchParams({
    pharmacyId: params.pharmacyId,
    sort: params.sort,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.level) query.set("level", params.level);
  if (params.search) query.set("search", params.search);

  return request<RiskList>(`/api/risk?${query}`, { token });
}



/* ---------- Admin Overview ---------- */

export interface AdminOverview {
  users: {
    USER: number;
    PHARMACY_OWNER: number;
    ADMIN: number;
    total: number;
  };
  pharmacies: {
    active: number;
    inactive: number;
  };
  medicines: number;
  inventoryItems: number;
  risk: {
    available: boolean;
    asOfDate: string | null;
    counts: Record<string, number>;
    baselineAlerts: number;
  };
  activeModel: {
    version: string;
    name?: string;
    trainedUntil?: string;
  } | null;
}

export function getAdminOverview(token: string) {
  return request<{ success: boolean; data: AdminOverview }>(
    "/api/admin/overview",
    { token }
  );
}

// ---------- Admin User Management ----------

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "USER" | "PHARMACY_OWNER" | "ADMIN";
  isActive: boolean;
  createdAt?: string;
}

export interface AdminUsersResponse {
  success: boolean;
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export function getAdminUsers(
  token: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    isActive?: string;
  }
) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.role) {
    query.set("role", params.role);
  }

  if (params.isActive) {
    query.set("isActive", params.isActive);
  }

  return request<AdminUsersResponse>(
    `/api/admin/users?${query.toString()}`,
    { token }
  );
}

export function setAdminUserStatus(
  token: string,
  userId: string,
  isActive: boolean
) {
  return request<{ success: boolean; data: AdminUser }>(
    `/api/admin/users/${userId}/status`,
    {
      method: "PATCH",
      body: { isActive },
      token,
    }
  );
}



export interface AdminPharmacy {
  _id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isActive: boolean;
  inventoryCount: number;
  ownerId:
    | {
        _id: string;
        name: string;
        email: string;
      }
    | null;
  createdAt?: string;
}

export interface AdminPharmaciesResponse {
  success: boolean;
  data: AdminPharmacy[];
  total: number;
  page: number;
  limit: number;
}

export function getAdminPharmacies(
  token: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: string;
  }
) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.isActive) {
    query.set("isActive", params.isActive);
  }

  return request<AdminPharmaciesResponse>(
    `/api/admin/pharmacies?${query.toString()}`,
    { token }
  );
}

export function activateAdminPharmacy(
  token: string,
  pharmacyId: string
) {
  return request<{ success: boolean; data: AdminPharmacy }>(
    `/api/admin/pharmacies/${pharmacyId}/activate`,
    { method: "PATCH", token }
  );
}


export interface AdminMedicine {
  _id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  category: string;
  isActive: boolean;
  createdAt?: string;
}

export interface AdminMedicinesResponse {
  success: boolean;
  data: AdminMedicine[];
  total: number;
  page: number;
  limit: number;
}

export function getAdminMedicines(
  token: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: string;
  }
) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.isActive) {
    query.set("isActive", params.isActive);
  }

  return request<AdminMedicinesResponse>(
    `/api/admin/medicines?${query.toString()}`,
    { token }
  );
}

export function updateAdminMedicine(
  token: string,
  medicineId: string,
  body: Partial<
    Pick<
      AdminMedicine,
      | "name"
      | "genericName"
      | "strength"
      | "dosageForm"
      | "manufacturer"
      | "category"
    >
  >
) {
  return request<{
    success: boolean;
    data: AdminMedicine;
  }>(`/api/admin/medicines/${medicineId}`, {
    method: "PATCH",
    body,
    token,
  });
}

export function activateAdminMedicine(
  token: string,
  medicineId: string
) {
  return request<{
    success: boolean;
    data: AdminMedicine;
  }>(`/api/admin/medicines/${medicineId}/activate`, {
    method: "PATCH",
    token,
  });
}

export function deactivateAdminMedicine(
  token: string,
  medicineId: string
) {
  return request<{
    success: boolean;
    data: AdminMedicine;
  }>(`/api/admin/medicines/${medicineId}/deactivate`, {
    method: "PATCH",
    token,
  });
}


export interface AdminMedicineRisk {
  medicine: {
    id: string;
    name: string;
    genericName: string;
    strength: string;
    category: string;
  };
  pharmacies: number;
  high: number;
  medium: number;
  low: number;
  insufficientData: number;
  avgProbability: number | null;
  highShare: number;
}

export interface AdminRiskByMedicineResponse {
  success: boolean;
  available: boolean;
  asOfDate?: string;
  predictedForDate?: string;
  message?: string;
  data: AdminMedicineRisk[];
}

export function getAdminRiskByMedicine(
  token: string,
  limit = 20
) {
  return request<AdminRiskByMedicineResponse>(
    `/api/admin/risk/by-medicine?limit=${limit}`,
    { token }
  );
}


export interface AdminMLModel {
  _id: string;
  version: string;
  modelName: string;
  isActive: boolean;
  trainedUntil?: string;
  horizonDays?: number;
  cutoffs?: {
    high?: number;
    medium?: number;
  };
  metrics?: {
    precision?: number;
    recall?: number;
    f1?: number;
    prAuc?: number;
    rocAuc?: number;
    baselineF1?: number;
  };
  testPeriod?: {
    start?: string;
    end?: string;
  };
  activatedAt?: string;
  createdAt?: string;
}

export interface AdminMLModelsResponse {
  success: boolean;
  count: number;
  data: AdminMLModel[];
}

export function getAdminMLModels(token: string) {
  return request<AdminMLModelsResponse>("/api/admin/models", {
    token,
  });
}

export function getAdminActiveMLModel(token: string) {
  return request<{
    success: boolean;
    data: AdminMLModel | null;
  }>("/api/admin/models/active", { token });
}

export function getAdminMLModelComparison(
  token: string,
  version?: string
) {
  const query = new URLSearchParams();

  if (version) query.set("version", version);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return request<{
    success: boolean;
    available: boolean;
    version?: string;
    message?: string;
    predictionsChecked?: number;
    actualShortageRate?: number;
    mlHigh?: {
      precision: number;
      recall: number;
      f1: number;
      alertRate: number;
      tp: number;
      fp: number;
      fn: number;
      tn: number;
    };
    mlMediumPlus?: {
      precision: number;
      recall: number;
      f1: number;
      alertRate: number;
      tp: number;
      fp: number;
      fn: number;
      tn: number;
    };
    thresholdBaseline?: {
      precision: number;
      recall: number;
      f1: number;
      alertRate: number;
      tp: number;
      fp: number;
      fn: number;
      tn: number;
    };
    byRiskLevel?: Record<
      string,
      { count: number; shortageRate: number }
    >;
    model?: AdminMLModel | null;
  }>(`/api/admin/models/comparison${suffix}`, { token });
}


export function deactivateAdminPharmacy(
  token: string,
  pharmacyId: string
) {
  return request<{ success: boolean; data: AdminPharmacy }>(
    `/api/admin/pharmacies/${pharmacyId}/deactivate`,
    {
      method: "PATCH",
      token,
    }
  );
}