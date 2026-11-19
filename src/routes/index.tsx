import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Bell,
  ChevronRight,
  Cpu,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Table2,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardTab } from "@/components/smart-home/DashboardTab";
import { SensorsTab } from "@/components/smart-home/SensorsTab";
import { ActionHistoryTab } from "@/components/smart-home/ActionHistoryTab";
import { ProfileTab } from "@/components/smart-home/ProfileTab";
import { IoTProvider, useIoT } from "@/components/smart-home/IoTContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bảng Điều Khiển Smart Home IoT | Dashboard" },
      {
        name: "description",
        content:
          "Hệ thống giám sát và điều khiển Smart Home IoT qua MQTT: theo dõi nhiệt độ, độ ẩm, ánh sáng, nhật ký hành động và tự động hóa thiết bị.",
      },
      { property: "og:title", content: "Smart Home IoT Dashboard & MQTT" },
      {
        property: "og:description",
        content:
          "Giám sát cảm biến thời gian thực, điều khiển thiết bị và xem lịch sử thao tác qua MQTT & API Key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SmartHomeRoot,
});

const TABS = [
  {
    id: "dashboard",
    label: "Bảng điều khiển",
    icon: LayoutDashboard,
    desc: "Giám sát & điều khiển thời gian thực",
  },
  {
    id: "sensors",
    label: "Dữ liệu cảm biến",
    icon: Table2,
    desc: "Bảng dữ liệu đo đạc & phân tích",
  },
  {
    id: "logs",
    label: "Nhật ký hành động",
    icon: History,
    desc: "Lịch sử điều khiển & phản hồi phần cứng",
  },
  {
    id: "profile",
    label: "Hồ sơ cá nhân",
    icon: User,
    desc: "Thông tin cá nhân & giới thiệu",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SmartHomeRoot() {
  return (
    <IoTProvider>
      <SmartHomeGate />
    </IoTProvider>
  );
}

function SmartHomeGate() {
  const { authReady, apiKey } = useIoT();

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Đang khởi tạo kết nối hệ thống...
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return <LoginScreen />;
  }

  return <SmartHomeApp />;
}

function LoginScreen() {
  const { login, connectivity } = useIoT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">EcoLiving IoT</h1>
            <p className="text-xs font-medium text-muted-foreground">
              Đăng nhập để lấy API Key truy cập hệ thống
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-xs">
          <span className="font-medium text-muted-foreground">Backend API (:5050):</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-bold",
              connectivity.backendOnline ? "text-success" : "text-destructive",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                connectivity.backendOnline ? "bg-success" : "bg-destructive",
              )}
            />
            {connectivity.backendOnline ? "Trực tuyến" : "Ngoại tuyến"}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Tên đăng nhập</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Nhập username (vd: admin)"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm font-medium focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Nhập mật khẩu"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm font-medium focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SmartHomeApp() {
  const { user, connectivity, alerts, sensors, logout } = useIoT();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  const notifications = [
    ...alerts.map((a) => ({
      id: a.id,
      title: a.title,
      desc: a.message,
      time: sensors?.timestamp || "Vừa xong",
      tone: "danger" as const,
    })),
    {
      id: "mqtt-status",
      title: connectivity.mqttConnected ? "Đã kết nối máy chủ MQTT" : "Mất kết nối MQTT",
      desc: connectivity.mqttConnected
        ? "Đang lắng nghe dữ liệu thật từ broker.hivemq.com"
        : "Đang thử kết nối lại tới broker.hivemq.com",
      time: "Trạng thái hệ thống",
      tone: connectivity.mqttConnected ? ("ok" as const) : ("danger" as const),
    },
  ];

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex items-center gap-3.5 px-6 py-6 border-b border-border/40">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
          <Cpu className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-foreground">EcoLiving</p>
          <p className="truncate text-xs font-medium text-muted-foreground">IoT PTIT</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 space-y-1.5 px-4 py-5 overflow-y-auto">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setNavOpen(false);
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-xs font-semibold transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <t.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-left">{t.label}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                )}
              />
            </button>
          );
        })}
      </nav>

      {/* System Status Box */}
      <div className="mx-4 mb-3 space-y-2.5 rounded-2xl border border-border/60 bg-secondary/50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Trạng Thái Kết Nối
        </p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-foreground">Máy chủ MQTT</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                connectivity.mqttConnected ? "text-success" : "text-destructive",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connectivity.mqttConnected ? "bg-success" : "bg-destructive",
                )}
              />
              {connectivity.mqttConnected ? "Trực tuyến" : "Ngoại tuyến"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">Cơ sở dữ liệu</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                connectivity.databaseConnected ? "text-success" : "text-destructive",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connectivity.databaseConnected ? "bg-success" : "bg-destructive",
                )}
              />
              {connectivity.databaseConnected ? "Trực tuyến" : "Ngoại tuyến"}
            </span>
          </div>
        </div>
      </div>

      {/* User & Logout */}
      <div className="mx-4 mb-4 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground">
            {user?.fullName || user?.username}
          </p>
          <p className="truncate text-[11px] font-mono text-muted-foreground">{user?.username}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          title="Đăng xuất"
          className="inline-flex items-center gap-1 rounded-xl bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
          Thoát
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background text-foreground font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-[270px] shrink-0 border-r border-border/80 bg-card shadow-xs lg:flex lg:flex-col overflow-hidden">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-in fade-in duration-200">
          <button
            aria-label="Đóng menu"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-xs"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] bg-card shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setNavOpen(false)}
              className="absolute right-3.5 top-6 rounded-xl p-2 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
            {navContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Global Header */}
        <header className="shrink-0 sticky top-0 z-40 border-b border-border/80 bg-card/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNavOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary lg:hidden"
                aria-label="Mở menu"
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {currentTab.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Popover */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative grid h-10 w-10 place-items-center rounded-2xl border border-border bg-secondary/70 transition-all hover:bg-secondary cursor-pointer"
                  aria-label="Thông báo"
                >
                  <Bell className="h-4 w-4 text-foreground" />
                  {alerts.length > 0 && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
                  )}
                </button>

                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-84 overflow-hidden rounded-3xl border border-border/80 bg-white dark:bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10">
                      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
                        <p className="text-xs font-bold text-foreground">Cảnh Báo & Thông Báo</p>
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                          {alerts.length} cảnh báo
                        </span>
                      </div>
                      <ul className="max-h-[340px] overflow-y-auto divide-y divide-border/40 bg-white dark:bg-card overscroll-contain">
                        {notifications.map((n) => (
                          <li key={n.id} className="p-3.5 hover:bg-secondary/60 transition-colors">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={cn(
                                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                  n.tone === "danger" && "bg-destructive",
                                  n.tone === "ok" && "bg-success",
                                )}
                              />
                              <div>
                                <p className="text-xs font-bold text-foreground">{n.title}</p>
                                <p className="mt-0.5 text-xs text-foreground/80 font-medium leading-relaxed">
                                  {n.desc}
                                </p>
                                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                                  {n.time}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 min-h-0 flex flex-col px-4 py-3 sm:px-6 sm:py-3.5 overflow-hidden">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "sensors" && <SensorsTab />}
          {activeTab === "logs" && <ActionHistoryTab />}
          {activeTab === "profile" && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <ProfileTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
