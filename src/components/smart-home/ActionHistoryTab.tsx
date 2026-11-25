import { useState, useEffect, useCallback } from "react";
import {
  AirVent,
  ArrowUpDown,
  ChevronDown,
  Fan,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { cn, getVisiblePages } from "@/lib/utils";
import { fetchActionHistory } from "@/lib/api";
import type { ActionRecord } from "./mockData";
import { useIoT } from "./IoTContext";

export function ActionHistoryTab() {
  const { apiKey, actionEventTick } = useIoT();

  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchTermInput, setSearchTermInput] = useState("");
  const [deviceInput, setDeviceInput] = useState<string>("ALL");
  const [actionInput, setActionInput] = useState<string>("ALL");
  const [statusInput, setStatusInput] = useState<string>("ALL");

  const [sortField, setSortField] = useState<"id" | "deviceName" | "sentTime">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchActionHistory({
        page: currentPage,
        limit: pageSize,
        device: deviceInput,
        action: actionInput,
        status: statusInput,
        search: searchTermInput,
        sortBy: sortField,
        sortOrder,
      });
      setRecords(res.records);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể tải nhật ký hành động");
    } finally {
      setLoading(false);
    }
  }, [
    apiKey,
    currentPage,
    pageSize,
    deviceInput,
    actionInput,
    statusInput,
    searchTermInput,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (actionEventTick > 0 && currentPage === 1) {
      loadData();
    }
  }, [actionEventTick, currentPage, loadData]);

  const handleSort = (field: "id" | "deviceName" | "sentTime") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleResetFilters = () => {
    setSearchTermInput("");
    setDeviceInput("ALL");
    setActionInput("ALL");
    setStatusInput("ALL");
    setCurrentPage(1);
    setPageSize(10);
  };

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-2.5 h-full overflow-hidden">
      {/* Header & Filter Card */}
      <div className="shrink-0 rounded-2xl border border-border/80 bg-card p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-bold text-foreground">Nhật ký hành động</h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {totalCount} bản ghi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Làm mới
            </button>
            <span className="text-xs font-medium text-muted-foreground">Hiển thị</span>
            <div className="relative inline-block">
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-xl border border-border bg-background pl-3 pr-8 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:border-primary/50 focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value={5}>5 dòng</option>
                <option value={10}>10 dòng</option>
                <option value={20}>20 dòng</option>
                <option value={30}>30 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Bộ lọc thiết bị, hành động, trạng thái */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm thiết bị, thời gian..."
              value={searchTermInput}
              onChange={(e) => {
                setSearchTermInput(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-xs font-medium placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {searchTermInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchTermInput("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium shadow-xs">
            <span className="text-muted-foreground text-xs whitespace-nowrap">Thiết bị:</span>
            <select
              value={deviceInput}
              onChange={(e) => {
                setDeviceInput(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Tất cả thiết bị</option>
              <option value="FAN">Quạt (LED 2)</option>
              <option value="LIGHT">Đèn (LED 3)</option>
              <option value="AC">Điều hòa (LED 1)</option>
              <option value="led4">Đèn cảnh báo (LED 4)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium shadow-xs">
            <span className="text-muted-foreground text-xs whitespace-nowrap">Hành động:</span>
            <select
              value={actionInput}
              onChange={(e) => {
                setActionInput(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="ON">BẬT</option>
              <option value="OFF">TẮT</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium shadow-xs">
            <span className="text-muted-foreground text-xs whitespace-nowrap">Trạng thái:</span>
            <select
              value={statusInput}
              onChange={(e) => {
                setStatusInput(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ON">BẬT</option>
              <option value="OFF">TẮT</option>
              <option value="LOADING">Đang xử lý</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            Tìm kiếm
          </button>

          {(searchTermInput ||
            deviceInput !== "ALL" ||
            actionInput !== "ALL" ||
            statusInput !== "ALL") && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/80 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-secondary/50 font-bold uppercase tracking-wider text-muted-foreground">
                <th
                  onClick={() => handleSort("id")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ID</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("deviceName")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Thiết bị</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-2">Hành động</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th
                  onClick={() => handleSort("sentTime")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Thời gian gửi</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-2">Thời gian phản hồi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {errorMsg ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-destructive">
                    {errorMsg}
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono font-bold text-primary">{r.id}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
                          {r.deviceType === "FAN" && <Fan className="h-3.5 w-3.5" />}
                          {r.deviceType === "LIGHT" && (
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          {r.deviceType === "AC" && (
                            <AirVent className="h-3.5 w-3.5 text-sky-500" />
                          )}
                        </div>
                        <span className="font-semibold text-foreground">{r.deviceName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-lg px-2.5 py-0.5 font-mono text-xs font-bold",
                          r.action === "ON" && "bg-success/15 text-success",
                          r.action === "OFF" && "bg-secondary text-muted-foreground",
                        )}
                      >
                        {r.action === "ON" ? "BẬT" : "TẮT"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "ON" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          BẬT
                        </span>
                      )}
                      {r.status === "OFF" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          TẮT
                        </span>
                      )}
                      {r.status === "LOADING" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Đang xử lý
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{r.sentTime}</td>
                    <td className="px-4 py-2 font-mono font-medium text-foreground">
                      {r.responseTime}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {searchTermInput ||
                    deviceInput !== "ALL" ||
                    actionInput !== "ALL" ||
                    statusInput !== "ALL"
                      ? "Không có nhật ký nào thỏa mãn tìm kiếm và bộ lọc."
                      : "Chưa có lịch sử thao tác nào trong cơ sở dữ liệu."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-end border-t border-border/80 px-4 py-2.5 bg-card mt-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3.5 py-1.5 font-semibold text-foreground shadow-2xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Trước
            </button>

            {visiblePages.map((page, idx) => {
              if (page === "...") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-1.5 py-1 text-xs font-bold text-muted-foreground select-none"
                  >
                    ...
                  </span>
                );
              }
              const pageNum = Number(page);
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "min-w-[34px] h-[32px] px-2.5 inline-flex items-center justify-center rounded-xl text-xs transition-colors cursor-pointer",
                    isActive
                      ? "bg-blue-600 text-white font-bold border border-blue-600 shadow-xs"
                      : "border border-border bg-background text-foreground font-semibold hover:bg-secondary",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3.5 py-1.5 font-semibold text-foreground shadow-2xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
