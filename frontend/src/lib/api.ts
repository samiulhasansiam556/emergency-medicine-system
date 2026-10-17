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