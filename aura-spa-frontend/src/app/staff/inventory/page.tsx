"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export default function StaffInventory() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";

  const [rawInventory, setRawInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError("");
    try {
      const data = await managerService.getInventory(branchId);
      setRawInventory(data || []);
    } catch (err) {
      console.error("Error loading staff inventory:", err);
      setError("Không thể kết nối cơ sở dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const items = useMemo(() => {
    return rawInventory.map((item: any) => {
      const quantity = toNumber(item.currentQuantity);
      const minThreshold = toNumber(item.inventoryItem?.minStockLevel);
      const maxStock = 100; // default cap
      return {
        id: item.inventoryItem?.id || item.id,
        name: item.inventoryItem?.name || "Chưa đặt tên",
        category: item.inventoryItem?.category || "Khác",
        unit: item.inventoryItem?.unit || "Chai",
        quantity,
        minThreshold,
        maxStock,
        lastRestocked: item.lastTransactionAt ? new Date(item.lastTransactionAt).toLocaleDateString("vi-VN") : "—",
        isLow: !!item.isLowStock || quantity < minThreshold,
      };
    });
  }, [rawInventory]);

  const filtered = useMemo(() => {
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Kho vật tư</h1>
          <p className="text-xs text-on-surface-variant mt-1">Tra cứu tồn kho thực tế của chi nhánh để chuẩn bị trị liệu.</p>
        </div>
        {branchId && (
          <span className="font-label-sm text-label-sm text-primary font-bold bg-primary/10 px-3 py-1 rounded-full text-xs">
            Chi nhánh #{branchId}
          </span>
        )}
      </div>

      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 20 }}>search</span>
        <input
          className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-xl bg-white focus:outline-none focus:border-primary transition-colors"
          placeholder="Tìm kiếm vật tư..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant font-label-md text-sm">
          Đang tải dữ liệu tồn kho thực tế...
        </div>
      ) : error ? (
        <div className="text-center py-12 text-error font-label-md text-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant font-label-md text-sm">
          Không tìm thấy vật tư nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const pct = Math.min(Math.round((item.quantity / item.maxStock) * 100), 100);
            return (
              <div key={item.id} className={`bg-white rounded-2xl p-5 border-2 transition-all ${item.isLow ? "border-error/40 shadow-sm shadow-error/10 bg-error-[2%]" : "border-outline-variant/20"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-label-md text-label-md text-on-surface font-bold">{item.name}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{item.category} · {item.unit}</p>
                  </div>
                  {item.isLow && (
                    <span className="bg-error-container text-error text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
                      Sắp hết
                    </span>
                  )}
                </div>

                <div className="flex items-end justify-between mb-2">
                  <span className={`font-headline-sm text-2xl font-bold ${item.isLow ? "text-error" : "text-on-surface"}`}>{item.quantity}</span>
                  <span className="text-on-surface-variant text-sm">/ {item.maxStock} {item.unit}</span>
                </div>

                <div className="h-2 bg-surface-container rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${item.isLow ? "bg-error" : pct > 60 ? "bg-primary" : "bg-secondary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="text-xs text-on-surface-variant">Ngưỡng tối thiểu: {item.minThreshold} {item.unit}</p>
                <p className="text-xs text-on-surface-variant">Nhập kho lần cuối: {item.lastRestocked}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
