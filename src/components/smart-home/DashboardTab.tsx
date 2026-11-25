import { useState, useRef, useEffect } from "react";
import {
  AirVent,
  AlertCircle,
  Bell,
  CheckCircle2,
  Droplets,
  Fan,
  Flame,
  Lightbulb,
  Radio,
  Sun,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { sendDeviceControl, sendControlAll } from "@/lib/api";
import { useIoT } from "./IoTContext";

export interface DeviceState {
  id: "led1" | "led2" | "led3" | "led4";
  name: string;
  subtitle: string;
  type: "FAN" | "LIGHT" | "AC";
  on: boolean;
}

export function DashboardTab() {
  const { sensors, devices, chartData, alerts, connectivity, user, refreshDashboard } = useIoT();

  const [loadingDevice, setLoadingDevice] = useState<string | null>(null);
  const [controlFeedback, setControlFeedback] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensorCards = [
    {
      id: "temp",
      name: "Nhiệt độ",
      value: sensors?.temperature != null ? sensors.temperature.toFixed(1) : "--",
      unit: "°C",
      icon: Thermometer,
      status: sensors?.tempStatus || "NORMAL",
      accentColor: "text-rose-500 bg-rose-500/10",
    },
    {
      id: "humidity",
      name: "Độ ẩm",
      value: sensors?.humidity != null ? sensors.humidity.toFixed(1) : "--",
      unit: "%",
      icon: Droplets,
      status: sensors?.humStatus || "NORMAL",
      accentColor: "text-sky-500 bg-sky-500/10",
    },
    {
      id: "light",
      name: "Ánh sáng",
      value: sensors?.light != null ? Math.round(sensors.light).toString() : "--",
      unit: "Lux",
      icon: Sun,
      status: sensors?.luxStatus || "NORMAL",
      accentColor: "text-amber-500 bg-amber-500/10",
    },
    {
      id: "gas",
      name: "Khí Gas (MQ-2)",
      value: sensors?.gas != null ? sensors.gas.toFixed(1) : "--",
      unit: "ppm",
      icon: Flame,
      status: sensors?.gasStatus || "NORMAL",
      accentColor: "text-violet-500 bg-violet-500/10",
    },
  ];

  const deviceList: DeviceState[] = [
    {
      id: "led2",
      name: "Quạt thông gió",
      subtitle: "GPIO 6 · LED 2",
      type: "FAN",
      on: devices?.led2?.state === "ON",
    },
    {
      id: "led3",
      name: "Đèn chiếu sáng",
      subtitle: "GPIO 7 · LED 3",
      type: "LIGHT",
      on: devices?.led3?.state === "ON",
    },
    {
      id: "led1",
      name: "Điều hòa",
      subtitle: "GPIO 5 · LED 1",
      type: "AC",
      on: devices?.led1?.state === "ON",
    },
    {
      id: "led4",
      name: "Đèn cảnh báo",
      subtitle: "GPIO 3 · LED 4",
      type: "LIGHT",
      on: devices?.led4?.state === "ON",
    },
  ];

  // Khi nhận được cập nhật thiết bị từ ESP32, tắt trạng thái đang gửi
  useEffect(() => {
    if (loadingDevice) {
      setLoadingDevice(null);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  const handleToggleDevice = async (dev: DeviceState) => {
    setLoadingDevice(dev.id);
    setControlFeedback(null);
    const nextOn = !dev.on;
    try {
      await sendDeviceControl(dev.id, nextOn, user?.fullName);
      // Nếu mạch chưa cắm thật để trả ACK, tự giải phóng trạng thái chờ sau 3 giây
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingDevice((curr) => (curr === dev.id ? null : curr));
        setControlFeedback(
          `Đã gửi lệnh ${nextOn ? "BẬT" : "TẮT"} ${dev.name} qua MQTT (đang chờ ESP32 phản hồi ACK).`,
        );
        refreshDashboard();
      }, 3000);
    } catch (err) {
      setLoadingDevice(null);
      setControlFeedback(err instanceof Error ? err.message : "Không gửi được lệnh tới Backend");
    }
  };

  const handleToggleAll = async (turnOn: boolean) => {
    setLoadingDevice("all");
    setControlFeedback(null);
    try {
      const res = await sendControlAll(turnOn);
      setControlFeedback(res.message);
      setTimeout(() => {
        setControlFeedback(null);
        refreshDashboard();
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể điều khiển tất cả";
      setControlFeedback("Lỗi: " + message);
      setTimeout(() => setControlFeedback(null), 3500);
    } finally {
      setTimeout(() => setLoadingDevice(null), 500);
    }
  };

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedChart, setSelectedChart] = useState<"ALL" | "TEMPERATURE" | "HUMIDITY" | "LIGHT">(
    "ALL",
  );

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const measure = () => setChartWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topAlert = alerts[0];
  const preparedChartData = chartData.map((d) => ({
    ...d,
    luxScaled: d.lux != null ? Math.round(d.lux / 10) : null,
  }));

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col space-y-2.5 overflow-hidden">
      {/* Dynamic Alert / Connection Banner */}
      {!connectivity.backendOnline ? (
        <div className="shrink-0 flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-destructive shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-xs font-medium truncate">
            <strong>Mất kết nối Backend:</strong> Không kết nối được tới{" "}
            <code className="font-mono">http://localhost:5050</code>. Hãy kiểm tra lại server
            backend.
          </p>
        </div>
      ) : !sensors?.hasData ? (
        <div className="shrink-0 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-foreground shadow-xs">
          <Radio className="h-4 w-4 shrink-0 text-primary animate-pulse" />
          <p className="text-xs font-medium truncate">
            <strong>Đang chờ cảm biến thật:</strong> Kết nối MQTT{" "}
            {connectivity.mqttConnected ? "đã sẵn sàng" : "đang kết nối"} — hãy bật nguồn ESP32 để
            nhận gói tin từ topic <code className="font-mono font-bold">ssdata</code>.
          </p>
        </div>
      ) : topAlert ? (
        <div
          className={cn(
            "shrink-0 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-xs",
            topAlert.tone === "critical"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-warning/30 bg-warning/10 text-warning-foreground",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-xs font-medium truncate">
            <strong>{topAlert.title}:</strong> {topAlert.message}
          </p>
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success/10 px-3.5 py-2 text-success shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-xs font-medium truncate">
            <strong>Hệ thống ổn định:</strong> Dữ liệu cảm biến thật đang cập nhật · Lần đo gần
            nhất: <span className="font-mono">{sensors.timestamp}</span>
          </p>
        </div>
      )}

      {/* Sensor Cards (4 ô cảm biến ở trên) */}
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4 shrink-0">
        {sensorCards.map((s) => {
          const chartType =
            s.id === "temp"
              ? "TEMPERATURE"
              : s.id === "humidity"
                ? "HUMIDITY"
                : s.id === "light"
                  ? "LIGHT"
                  : "ALL";
          const isSelected = selectedChart === chartType;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedChart((prev) => (prev === chartType ? "ALL" : chartType))}
              className={cn(
                "group relative text-left overflow-hidden rounded-2xl border bg-card p-3 shadow-xs transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-primary ring-2 ring-primary/30 shadow-md"
                  : "border-border/80 hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground truncate">{s.name}</span>
                    {isSelected && (
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    {sensors?.hasData && s.status !== "NORMAL" && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0",
                          s.status === "CRITICAL"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-warning/15 text-warning-foreground",
                        )}
                      >
                        {s.status === "CRITICAL" ? "Nguy hiểm" : "Cảnh báo"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                      {s.value}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-muted-foreground">{s.unit}</span>
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-xl p-2.5 shrink-0 transition-transform group-hover:scale-105",
                    s.accentColor,
                  )}
                >
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Middle Section: Biểu đồ riêng cảm biến mới bên trái + Biểu đồ cũ bên phải */}
      <div className="flex-1 min-h-0 grid gap-2.5 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Biểu đồ riêng cho cảm biến mới (Khí Gas MQ-2) */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-xs lg:col-span-5 xl:col-span-5 h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 pb-2 shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-violet-500" />
                <h2 className="font-display text-xs font-bold text-foreground">
                  Biểu đồ Khí Gas (MQ-2)
                </h2>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5 font-medium truncate">
                Mức đo: {sensors?.gas != null ? `${sensors.gas.toFixed(1)} ppm` : "--"} · Cảnh báo: &gt; 400 ppm
              </p>
            </div>
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">
              Cảm biến riêng
            </span>
          </div>

          <div className="flex-1 min-h-0 mt-2">
            {!sensors?.hasData || preparedChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Flame className="h-7 w-7 text-muted-foreground/30 mb-1" />
                <p className="font-semibold text-foreground">Chưa có dữ liệu khí Gas</p>
                <p className="mt-0.5 text-[11px]">Đang chờ dữ liệu thời gian thực từ ESP32...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={preparedChartData}
                  margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gasGradientMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    domain={[0, "auto"]}
                    unit=" ppm"
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val} ppm`, "Nồng độ Khí Gas"]}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gas"
                    name="Khí Gas (ppm)"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#gasGradientMain)"
                    dot={{ r: 2.5, fill: "#8b5cf6" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column: Biểu đồ cũ (Nhiệt độ, Độ ẩm, Ánh sáng) */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-xs lg:col-span-7 xl:col-span-7 h-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 shrink-0">
            <div>
              <h2 className="font-display text-xs font-bold text-foreground">
                {selectedChart === "ALL" && "Biểu đồ tổng hợp các cảm biến"}
                {selectedChart === "TEMPERATURE" && "Biểu đồ Nhiệt độ (°C) — DHT11"}
                {selectedChart === "HUMIDITY" && "Biểu đồ Độ ẩm (%) — DHT11"}
                {selectedChart === "LIGHT" && "Biểu đồ Ánh sáng (Lux) — BH1750"}
              </h2>
              {selectedChart === "ALL" ? (
                <div className="flex flex-wrap items-center gap-2 text-[10px] pt-0.5">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Nhiệt độ
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Độ ẩm
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Ánh sáng
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground pt-0.5 font-medium truncate">
                  {selectedChart === "TEMPERATURE" &&
                    `Mức đo: ${sensors?.temperature != null ? `${sensors.temperature.toFixed(1)} °C` : "--"} • Ngưỡng: 18°C - 28°C`}
                  {selectedChart === "HUMIDITY" &&
                    `Mức đo: ${sensors?.humidity != null ? `${sensors.humidity.toFixed(1)} %` : "--"} • Ngưỡng: > 70%`}
                  {selectedChart === "LIGHT" &&
                    `Mức đo: ${sensors?.light != null ? `${Math.round(sensors.light)} Lux` : "--"} • Ngưỡng: < 100 Lux`}
                </p>
              )}
            </div>

            <div className="flex items-center rounded-xl bg-secondary/80 p-0.5 border border-border/70 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedChart("ALL")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                  selectedChart === "ALL"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setSelectedChart("TEMPERATURE")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                  selectedChart === "TEMPERATURE"
                    ? "bg-rose-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-rose-500",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Nhiệt độ
              </button>
              <button
                type="button"
                onClick={() => setSelectedChart("HUMIDITY")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                  selectedChart === "HUMIDITY"
                    ? "bg-sky-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-sky-500",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Độ ẩm
              </button>
              <button
                type="button"
                onClick={() => setSelectedChart("LIGHT")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                  selectedChart === "LIGHT"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-amber-500",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Ánh sáng
              </button>
            </div>
          </div>

          <div ref={chartRef} className="mt-2 w-full flex-1 min-h-0">
            {preparedChartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-6 text-xs text-muted-foreground">
                <Radio className="h-7 w-7 text-primary/60 mb-2 animate-pulse" />
                <p className="font-semibold text-foreground">
                  Chưa có dữ liệu biểu đồ từ cảm biến thật
                </p>
                <p className="mt-1 max-w-md">
                  Khi ESP32 gửi dữ liệu lên MQTT topic{" "}
                  <code className="font-mono">ssdata</code>, biểu đồ sẽ tự động cập nhật
                  theo thời gian thực.
                </p>
              </div>
            ) : (
              <>
                {selectedChart === "ALL" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={preparedChartData}
                      margin={{ top: 8, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="temp"
                        name="Nhiệt độ (°C)"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "var(--chart-1)" }}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hum"
                        name="Độ ẩm (%)"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "var(--chart-2)" }}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="luxScaled"
                        name="Ánh sáng (Lux/10)"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "var(--chart-3)" }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {selectedChart === "TEMPERATURE" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={preparedChartData}
                      margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="tempGradientMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        domain={[0, "auto"]}
                        unit="°C"
                      />
                      <Tooltip
                        formatter={(val: number) => [`${val} °C`, "Nhiệt độ"]}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="temp"
                        name="Nhiệt độ (°C)"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#tempGradientMain)"
                        dot={{ r: 2.5, fill: "#ef4444" }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {selectedChart === "HUMIDITY" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={preparedChartData}
                      margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="humGradientMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        domain={[0, 100]}
                        unit="%"
                      />
                      <Tooltip
                        formatter={(val: number) => [`${val} %`, "Độ ẩm"]}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="hum"
                        name="Độ ẩm (%)"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#humGradientMain)"
                        dot={{ r: 2.5, fill: "#0ea5e9" }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {selectedChart === "LIGHT" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={preparedChartData}
                      margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="luxGradientMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        formatter={(val: number) => [`${val} Lux`, "Ánh sáng"]}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="lux"
                        name="Ánh sáng (Lux)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#luxGradientMain)"
                        dot={{ r: 2.5, fill: "#f59e0b" }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Các nút bật tắt để hàng ngang bên dưới */}
      <div className="shrink-0 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Bảng điều khiển thiết bị
            </h2>
          </div>
          {controlFeedback && (
            <span className="text-[11px] font-medium text-primary truncate max-w-md">
              {controlFeedback}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút Bật/Tắt Tất Cả LED */}
            <div className="flex items-center gap-1.5 bg-secondary/40 p-0.5 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                disabled={loadingDevice === "all"}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                title="Bật đồng loạt cả 4 đèn LED"
              >
                {loadingDevice === "all" ? "Đang gửi..." : "Bật tất cả"}
              </button>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                disabled={loadingDevice === "all"}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-border transition-all cursor-pointer disabled:opacity-50"
                title="Tắt đồng loạt cả 4 đèn LED"
              >
                {loadingDevice === "all" ? "..." : "Tắt tất cả"}
              </button>
            </div>

            <span className="text-xs text-muted-foreground font-medium">
              <span className="font-bold text-foreground">
                {deviceList.filter((d) => d.on).length}/{deviceList.length}
              </span>{" "}
              đang BẬT
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold",
                connectivity.mqttConnected ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connectivity.mqttConnected ? "bg-primary animate-pulse" : "bg-muted-foreground",
                )}
              />
              {connectivity.mqttConnected ? "MQTT Trực tiếp" : "MQTT Offline"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {deviceList.map((d) => {
            const isLoading = loadingDevice === d.id;
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-xl border p-2.5 transition-all duration-200",
                  d.on
                    ? "border-primary/30 bg-primary/[0.03]"
                    : "border-border/60 bg-secondary/20",
                )}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-all",
                        d.on
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {d.type === "FAN" && (
                        <Fan className={cn("h-4 w-4", d.on && "animate-spin")} />
                      )}
                      {d.type === "LIGHT" && d.id !== "led4" && (
                        <Lightbulb
                          className={cn("h-4 w-4", d.on && "fill-amber-300 text-amber-300")}
                        />
                      )}
                      {d.id === "led4" && (
                        <Bell
                          className={cn(
                            "h-4 w-4",
                            d.on ? "fill-rose-400 text-rose-500 animate-pulse" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {d.type === "AC" && (
                        <AirVent className={cn("h-4 w-4", d.on && "animate-pulse")} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-bold text-foreground truncate">{d.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ({d.id})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span
                          className={cn(
                            "font-bold",
                            isLoading
                              ? "text-amber-500"
                              : d.on
                                ? "text-success"
                                : "text-muted-foreground",
                          )}
                        >
                          {isLoading ? "Chờ ACK..." : d.on ? "BẬT" : "TẮT"}
                        </span>
                        <span className="text-muted-foreground truncate">· {d.subtitle}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={d.on}
                    disabled={isLoading}
                    onClick={() => handleToggleDevice(d)}
                    className={cn(
                      "relative h-5.5 w-10 shrink-0 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
                      isLoading
                        ? "bg-amber-400 opacity-80"
                        : d.on
                          ? "bg-success"
                          : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow-xs transition-all duration-200 ease-out",
                        d.on ? "left-5" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
