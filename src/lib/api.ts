/**
 * Dịch vụ API & Socket.IO kết nối Web Frontend với Backend IoT (NodeJS cổng 5050)
 */
import { io, type Socket } from "socket.io-client";
import type { ActionRecord, SensorDataRecord } from "@/components/smart-home/mockData";

export const BACKEND_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BACKEND_URL"]) ||
  "http://localhost:5050";

const API_KEY_STORAGE_KEY = "ecoliving_api_key";
const USER_STORAGE_KEY = "ecoliving_user";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
}

export interface SystemStatusResponse {
  success: boolean;
  mqtt: boolean;
  broker: string;
  database: string;
  databaseConnected: boolean;
  connectedWebClients: number;
}

export interface LatestSensorsPayload {
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  gas?: number | null;
  tempStatus: "NORMAL" | "WARNING" | "CRITICAL";
  humStatus: "NORMAL" | "WARNING" | "CRITICAL";
  luxStatus: "NORMAL" | "WARNING" | "CRITICAL";
  gasStatus?: "NORMAL" | "WARNING" | "CRITICAL";
  timestamp: string | null;
  hasData: boolean;
}

export interface BackendDeviceState {
  key: "led1" | "led2" | "led3" | "led4";
  uiId: string;
  name: string;
  type: "FAN" | "LIGHT" | "AC" | "ALARM";
  state: "ON" | "OFF";
  auto: boolean;
  lastUpdated: string | null;
}

export interface ChartPoint {
  time: string;
  fullTime?: string;
  temp: number | null;
  hum: number | null;
  lux: number | null;
  gas?: number | null;
}

export interface DashboardAlert {
  id: string;
  tone: "warning" | "critical";
  title: string;
  message: string;
}

export interface DashboardResponse {
  success: boolean;
  sensors: LatestSensorsPayload;
  devices: Record<"led1" | "led2" | "led3" | "led4", BackendDeviceState>;
  chart: ChartPoint[];
  alerts: DashboardAlert[];
  mqtt: boolean;
  database: string;
  totals: { sensors: number; actions: number };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized() {
  clearStoredAuth();
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredAuth(apiKey: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

async function apiFetch<T>(path: string, init: RequestInit = {}, timeoutMs = 4000): Promise<T> {
  const apiKey = getStoredApiKey();
  const headers = new Headers(init.headers);
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 401) {
    notifyUnauthorized();
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || "Phiên đăng nhập hết hạn hoặc thiếu API key");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Lỗi máy chủ (${res.status})`);
  }
  return data as T;
}

export async function loginApi(
  username: string,
  password: string,
): Promise<{ apiKey: string; user: AuthUser }> {
  const res = await fetch(`${BACKEND_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(4000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.api_key) {
    throw new Error(data?.message || "Đăng nhập thất bại");
  }

  setStoredAuth(data.api_key, data.user);
  return { apiKey: data.api_key, user: data.user };
}

export async function logoutApi(): Promise<void> {
  const apiKey = getStoredApiKey();
  try {
    if (apiKey) {
      await fetch(`${BACKEND_URL}/api/logout`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(3000),
      });
    }
  } finally {
    clearStoredAuth();
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getStoredApiKey()) return null;
  try {
    const res = await apiFetch<{ success: boolean; user: AuthUser }>("/api/me");
    return res.user;
  } catch {
    return null;
  }
}

export async function checkBackendStatus(): Promise<SystemStatusResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as SystemStatusResponse;
  } catch {
    return null;
  }
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/dashboard");
}

interface RawSensorRow {
  id: number;
  sensor_name: string;
  sensor_type: "TEMPERATURE" | "HUMIDITY" | "LIGHT";
  room: string;
  value: number;
  unit: string;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  topic: string;
  created_at: string;
  raw_payload?: string | null;
}

export interface SensorHistoryParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function fetchSensorHistory(params: SensorHistoryParams = {}): Promise<{
  records: SensorDataRecord[];
  pagination: PaginationMeta;
}> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));
  if (params.type && params.type !== "ALL") query.set("type", params.type);
  if (params.status && params.status !== "ALL") query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const json = await apiFetch<{
    success: boolean;
    data: RawSensorRow[];
    pagination: PaginationMeta;
  }>(`/api/sensors/history?${query.toString()}`);

  const records: SensorDataRecord[] = (json.data || []).map((row) => {
    let parsedRaw: Record<string, unknown> = {};
    if (row.raw_payload) {
      try {
        parsedRaw = JSON.parse(row.raw_payload) as Record<string, unknown>;
      } catch {
        parsedRaw = { raw: row.raw_payload };
      }
    }
    return {
      id: `#DS-${String(row.id).padStart(3, "0")}`,
      sensorName: row.sensor_name,
      sensorType: row.sensor_type,
      room: row.room,
      value: row.value,
      unit: row.unit,
      timestamp: row.created_at,
      status: row.status,
      topic: row.topic,
      rawPayload: parsedRaw,
    };
  });

  return { records, pagination: json.pagination };
}

interface RawActionRow {
  id: number;
  device_id: string;
  device_name: string;
  device_type: "FAN" | "LIGHT" | "AC";
  action: "ON" | "OFF";
  status: "ON" | "OFF" | "LOADING";
  sent_time: string;
  response_time: string;
  performed_by: string;
  detail: string | null;
}

export interface ActionHistoryParams {
  page?: number;
  limit?: number;
  device?: string;
  action?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function fetchActionHistory(params: ActionHistoryParams = {}): Promise<{
  records: ActionRecord[];
  pagination: PaginationMeta;
}> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));
  if (params.device && params.device !== "ALL") query.set("device", params.device);
  if (params.action && params.action !== "ALL") query.set("action", params.action);
  if (params.status && params.status !== "ALL") query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const json = await apiFetch<{
    success: boolean;
    data: RawActionRow[];
    pagination: PaginationMeta;
  }>(`/api/actions/history?${query.toString()}`);

  const records: ActionRecord[] = (json.data || []).map((row) => ({
    id: `#ACT-${String(row.id).padStart(3, "0")}`,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    action: row.action,
    status: row.status,
    sentTime: row.sent_time,
    responseTime: row.response_time,
    performedBy: row.performed_by,
    detail: row.detail || "",
  }));

  return { records, pagination: json.pagination };
}

export async function sendDeviceControl(device: string, action: boolean, performedBy?: string) {
  return apiFetch<{
    success: boolean;
    logId: number;
    message: string;
    device: string;
    action: string;
    sentTime: string;
  }>("/api/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device,
      action: action ? "ON" : "OFF",
      performedBy,
    }),
  });
}

export function createIoTSocket(apiKey: string): Socket {
  return io(BACKEND_URL, {
    auth: { apiKey },
    transports: ["websocket", "polling"],
    reconnectionDelay: 2000,
  });
}
