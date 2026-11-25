import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import {
  type AuthUser,
  type BackendDeviceState,
  type ChartPoint,
  checkBackendStatus,
  createIoTSocket,
  type DashboardAlert,
  fetchDashboard,
  fetchMe,
  getStoredApiKey,
  getStoredUser,
  type LatestSensorsPayload,
  loginApi,
  logoutApi,
  onUnauthorized,
} from "@/lib/api";

interface SystemConnectivity {
  backendOnline: boolean;
  mqttConnected: boolean;
  databaseConnected: boolean;
}

interface IoTContextValue {
  authReady: boolean;
  user: AuthUser | null;
  apiKey: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  connectivity: SystemConnectivity;
  sensors: LatestSensorsPayload | null;
  devices: Record<"led1" | "led2" | "led3" | "led4", BackendDeviceState> | null;
  chartData: ChartPoint[];
  alerts: DashboardAlert[];
  loadingDashboard: boolean;
  dashboardError: string | null;
  refreshDashboard: () => Promise<void>;
  sensorEventTick: number;
  actionEventTick: number;
}

const IoTContext = createContext<IoTContextValue | null>(null);

export function IoTProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [connectivity, setConnectivity] = useState<SystemConnectivity>({
    backendOnline: false,
    mqttConnected: false,
    databaseConnected: false,
  });

  const [sensors, setSensors] = useState<LatestSensorsPayload | null>(null);
  const [devices, setDevices] = useState<Record<
    "led1" | "led2" | "led3" | "led4",
    BackendDeviceState
  > | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [sensorEventTick, setSensorEventTick] = useState(0);
  const [actionEventTick, setActionEventTick] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  // Kiểm tra phiên đăng nhập đã lưu khi mount ở client
  useEffect(() => {
    let active = true;
    const savedKey = getStoredApiKey();
    const savedUser = getStoredUser();

    if (!savedKey) {
      setAuthReady(true);
      return;
    }

    setApiKey(savedKey);
    if (savedUser) setUser(savedUser);

    fetchMe().then((verifiedUser) => {
      if (!active) return;
      if (verifiedUser) {
        setUser(verifiedUser);
        setApiKey(savedKey);
      } else {
        setUser(null);
        setApiKey(null);
      }
      setAuthReady(true);
    });

    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      setApiKey(null);
      setSensors(null);
      setDevices(null);
      setChartData([]);
      setAlerts([]);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Kiểm tra trạng thái Backend & MQTT định kỳ
  useEffect(() => {
    let active = true;
    const pollStatus = async () => {
      const status = await checkBackendStatus();
      if (!active) return;
      if (status) {
        setConnectivity({
          backendOnline: true,
          mqttConnected: Boolean(status.mqtt),
          databaseConnected: Boolean(status.databaseConnected),
        });
      } else {
        setConnectivity({
          backendOnline: false,
          mqttConnected: false,
          databaseConnected: false,
        });
      }
    };

    pollStatus();
    const timer = setInterval(pollStatus, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!apiKey) return;
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const data = await fetchDashboard();
      setSensors(data.sensors);
      setDevices(data.devices);
      setChartData(data.chart || []);
      setAlerts(data.alerts || []);
      setConnectivity((prev) => ({
        ...prev,
        backendOnline: true,
        mqttConnected: Boolean(data.mqtt),
        databaseConnected: true,
      }));
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Không thể tải dữ liệu từ Backend");
    } finally {
      setLoadingDashboard(false);
    }
  }, [apiKey]);

  // Nạp dữ liệu dashboard & mở kết nối Socket.IO realtime khi đã có apiKey
  useEffect(() => {
    if (!apiKey) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    refreshDashboard();

    const socket = createIoTSocket(apiKey);
    socketRef.current = socket;

    socket.on("initial_state", (payload) => {
      if (payload?.sensors) setSensors(payload.sensors);
      if (payload?.devices) setDevices(payload.devices);
      if (payload?.alerts) setAlerts(payload.alerts);
      setConnectivity((prev) => ({
        ...prev,
        backendOnline: true,
        mqttConnected: Boolean(payload?.mqtt),
        databaseConnected: true,
      }));
    });

    socket.on("system_status", (payload) => {
      setConnectivity((prev) => ({
        ...prev,
        backendOnline: true,
        mqttConnected: Boolean(payload?.mqtt),
      }));
    });

    socket.on("sensor_update", (payload) => {
      setSensors({
        temperature: payload.temperature,
        humidity: payload.humidity,
        light: payload.light,
        gas: payload.gas,
        tempStatus: payload.tempStatus,
        humStatus: payload.humStatus,
        luxStatus: payload.luxStatus,
        gasStatus: payload.gasStatus,
        timestamp: payload.timestamp,
        hasData: true,
      });
      if (payload.alerts) setAlerts(payload.alerts);
      if (payload.chartPoint) {
        setChartData((prev) => [...prev.slice(-14), payload.chartPoint]);
      }
      setSensorEventTick((t) => t + 1);
    });

    socket.on("device_update", (updatedDevices) => {
      if (updatedDevices) setDevices(updatedDevices);
      setActionEventTick((t) => t + 1);
    });

    socket.on("action_created", () => {
      setActionEventTick((t) => t + 1);
    });

    socket.on("action_ack", () => {
      setActionEventTick((t) => t + 1);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [apiKey, refreshDashboard]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginApi(username, password);
    setUser(result.user);
    setApiKey(result.apiKey);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    setApiKey(null);
    setSensors(null);
    setDevices(null);
    setChartData([]);
    setAlerts([]);
  }, []);

  return (
    <IoTContext.Provider
      value={{
        authReady,
        user,
        apiKey,
        login,
        logout,
        connectivity,
        sensors,
        devices,
        chartData,
        alerts,
        loadingDashboard,
        dashboardError,
        refreshDashboard,
        sensorEventTick,
        actionEventTick,
      }}
    >
      {children}
    </IoTContext.Provider>
  );
}

export function useIoT() {
  const ctx = useContext(IoTContext);
  if (!ctx) {
    throw new Error("useIoT must be used inside IoTProvider");
  }
  return ctx;
}
