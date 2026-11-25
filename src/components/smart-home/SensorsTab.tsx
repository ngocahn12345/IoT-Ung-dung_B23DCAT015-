import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, getVisiblePages } from "@/lib/utils";
import { fetchSensorHistory } from "@/lib/api";
import type { SensorDataRecord } from "./mockData";
import { useIoT } from "./IoTContext";

export function SensorsTab() {
  const { apiKey, sensorEventTick } = useIoT();

  const [records, setRecords] = useState<SensorDataRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const datePickerRef = useRef<HTMLInputElement>(null);

  const [searchTermInput, setSearchTermInput] = useState("");
  const [combinedFilterInput, setCombinedFilterInput] = useState<string>("ALL");

  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<string>("ALL");

  const [sortField, setSortField] = useState<"id" | "sensorName" | "value" | "timestamp">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchSensorHistory({
        page: currentPage,
        limit: pageSize,
        type: appliedFilter,
        search: appliedSearchTerm,
        sortBy: sortField,
        sortOrder,
      });
      setRecords(res.records);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể tải dữ liệu cảm biến");
    } finally {
      setLoading(false);
    }
  }, [apiKey, currentPage, pageSize, appliedFilter, appliedSearchTerm, sortField, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tự động cập nhật bảng khi có gói tin mới từ ESP32 và đang ở trang 1
  useEffect(() => {
    if (sensorEventTick > 0 && currentPage === 1) {
      loadData();
    }
  }, [sensorEventTick, currentPage, loadData]);

  const handleSort = (field: "id" | "sensorName" | "value" | "timestamp") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setAppliedSearchTerm(searchTermInput);
    setAppliedFilter(combinedFilterInput);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTermInput("");
    setCombinedFilterInput("ALL");
    setAppliedSearchTerm("");
    setAppliedFilter("ALL");
    setCurrentPage(1);
    setPageSize(10);
  };

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-2.5 h-full overflow-hidden">
      {/* Header Toolbar */}
      <div className="shrink-0 rounded-2xl border border-border/80 bg-card p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-bold text-foreground">Dữ liệu cảm biến</h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {totalCount} bản ghi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Tải lại dữ liệu"
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

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo giá trị (vd: >28), từ khóa hoặc ngày (YYYY-MM-DD)..."
              value={searchTermInput}
              onChange={(e) => setSearchTermInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className={cn(
                "w-full rounded-xl border border-border bg-background py-2 pl-9 text-xs font-medium placeholder:text-muted-foreground focus:border-primary focus:outline-none",
                combinedFilterInput === "TIME" ? "pr-14" : "pr-8",
              )}
            />
            {combinedFilterInput === "TIME" && (
              <>
                <input
                  type="date"
                  ref={datePickerRef}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.value) {
                      setSearchTermInput(e.target.value);
                    }
                  }}
                />
                <button
                  type="button"
                  title="Chọn ngày nhanh từ lịch"
                  onClick={() => {
                    try {
                      datePickerRef.current?.showPicker?.();
                    } catch {
                      datePickerRef.current?.focus();
                    }
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary cursor-pointer p-0.5 transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {searchTermInput && (
              <button
                type="button"
                onClick={() => setSearchTermInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium shadow-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0" />
            <select
              value={combinedFilterInput}
              onChange={(e) => setCombinedFilterInput(e.target.value)}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Tất cả cảm biến</option>
              <option value="TEMPERATURE">Cảm biến Nhiệt độ</option>
              <option value="HUMIDITY">Cảm biến Độ ẩm</option>
              <option value="LIGHT">Cảm biến Ánh sáng</option>
              <option value="GAS">Cảm biến Khí Gas (MQ-2)</option>
              <option value="TIME">Thời gian</option>
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
            combinedFilterInput !== "ALL" ||
            appliedSearchTerm ||
            appliedFilter !== "ALL") && (
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
                  onClick={() => handleSort("sensorName")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tên cảm biến</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("value")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Giá trị</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("timestamp")}
                  className="cursor-pointer px-4 py-2 hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Thời gian</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {errorMsg ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-destructive">
                    {errorMsg}
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-2 font-mono font-bold text-primary">{r.id}</td>
                    <td className="px-4 py-2 font-semibold text-foreground">{r.sensorName}</td>
                    <td className="px-4 py-2">
                      <span className="font-display text-sm font-bold text-foreground">
                        {r.value}
                      </span>{" "}
                      <span className="text-xs font-medium text-muted-foreground">{r.unit}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">
                      {r.timestamp.replace(/-/g, "/")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {appliedSearchTerm || appliedFilter !== "ALL" ? (
                      <>
                        Không tìm thấy bản ghi nào phù hợp với tìm kiếm và bộ lọc.{" "}
                        <button
                          onClick={handleResetFilters}
                          className="ml-2 font-bold text-primary underline cursor-pointer"
                        >
                          Bấm vào đây để đặt lại bộ lọc
                        </button>
                      </>
                    ) : (
                      "Chưa có dữ liệu cảm biến thật nào trong cơ sở dữ liệu. Hãy bật ESP32 để bắt đầu ghi nhận."
                    )}
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
