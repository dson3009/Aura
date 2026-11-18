"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";

type InventoryForm = { name: string; category: string; unit: string; quantity: string; minThreshold: string; maxStock: string };

interface InventoryItemRef {
  id?: string;
  name?: string;
  category?: string;
  unit?: string;
  minStockLevel?: number | string;
}

interface BranchInventoryRow {
  id: string;
  currentQuantity?: number | string;
  inventoryItem?: InventoryItemRef;
  lastTransactionAt?: string | null;
  isLowStock?: boolean;
}

interface RequirementRow {
  serviceId: string;
  service?: { name?: string };
  inventoryItem?: InventoryItemRef;
  quantityPerService?: number | string;
}

interface UiInventoryItem {
  id: string;
  branchInventoryId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minThreshold: number;
  maxStock: number;
  lastRestocked: string;
  isLow: boolean;
}

interface GroupedRequirement {
  serviceName: string;
  items: Array<{ name: string; quantity: number; unit: string; category: string }>;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.message === "SESSION_EXPIRED") return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (err.message.includes("Forbidden") || err.message.includes("permission") || err.message.includes("403")) {
      return "Tài khoản hiện tại chưa có quyền quản lý tồn kho của chi nhánh này.";
    }
    if (err.message.includes("Internal server error") || err.message.includes("500")) {
      return "Máy chủ đang lỗi khi đọc tồn kho chi nhánh. Vui lòng kiểm tra log backend endpoint /inventory/branch.";
    }
    if (err.message.includes("Failed to fetch")) {
      return "Không kết nối được backend. Vui lòng kiểm tra NEXT_PUBLIC_API_URL hoặc CORS.";
    }
    return err.message;
  }
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }
  return fallback;
}

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseQuantityInput(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, error: "Vui lòng nhập số lượng thực tế." };
  }

  if (trimmed.includes(",")) {
    return { value: null, error: "Không dùng dấu phẩy. Nếu là số lẻ, hãy dùng dấu chấm, ví dụ 8.011." };
  }

  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    return { value: null, error: "Số lượng chỉ được gồm chữ số và tối đa 3 chữ số thập phân." };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: "Số lượng phải từ 0 trở lên." };
  }

  return { value: parsed };
}

export default function ManagerInventory() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";

  const [rawInventory, setRawInventory] = useState<BranchInventoryRow[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stock" | "requirements">("stock");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryForm>({ name: "", category: "", unit: "", quantity: "", minThreshold: "", maxStock: "" });
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Load live inventory & requirements
  const loadInventory = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      showToast("Tài khoản quản lý chưa được gán chi nhánh nên không thể tải tồn kho.");
      return;
    }
    setLoading(true);
    try {
      const [inventoryResult, requirementsResult] = await Promise.allSettled([
        managerService.getInventory(branchId),
        managerService.getInventoryRequirements(),
      ]);
      if (inventoryResult.status === "rejected") {
        throw inventoryResult.reason;
      }
      if (requirementsResult.status === "rejected") {
        console.error("Error loading inventory requirements:", requirementsResult.reason);
        showToast("Không thể tải định lượng liệu trình, dữ liệu tồn kho vẫn khả dụng.");
      }
      const inventoryData = inventoryResult.value as unknown as BranchInventoryRow[];
      const reqsData = requirementsResult.status === "fulfilled" ? (requirementsResult.value as unknown as RequirementRow[]) : [];
      setRawInventory(inventoryData || []);
      setRequirements(reqsData || []);
    } catch (err) {
      console.error("Error loading inventory:", err);
      showToast(getErrorMessage(err, "Không thể tải dữ liệu tồn kho từ máy chủ."));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(id);
  }, [loadInventory]);

  // Map database format to UI items
  const items = useMemo(() => {
    return rawInventory.map((item): UiInventoryItem => {
      const quantity = toNumber(item.currentQuantity);
      const minThreshold = toNumber(item.inventoryItem?.minStockLevel);
      const maxStock = 100; // default cap
      return {
        id: item.inventoryItem?.id || item.id,
        branchInventoryId: item.id,
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
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const lowStock = useMemo(() => {
    return items.filter((i) => i.isLow);
  }, [items]);

  // Group requirements by service for easy viewing
  const groupedRequirements = useMemo(() => {
    const map = new Map<string, GroupedRequirement>();
    requirements.forEach((req) => {
      const sId = req.serviceId;
      const sName = req.service?.name || `Dịch vụ #${sId}`;
      const entry = map.get(sId) || { serviceName: sName, items: [] };
      entry.items.push({
        name: req.inventoryItem?.name || "Vật tư không tên",
        quantity: toNumber(req.quantityPerService),
        unit: req.inventoryItem?.unit || "đơn vị",
        category: req.inventoryItem?.category || "Khác"
      });
      map.set(sId, entry);
    });
    return Array.from(map.entries()).map(([serviceId, value]) => ({
      serviceId,
      ...value
    }));
  }, [requirements]);

  const filteredRequirements = useMemo(() => {
    return groupedRequirements.filter(
      (gr) =>
        !search ||
        gr.serviceName.toLowerCase().includes(search.toLowerCase()) ||
        gr.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [groupedRequirements, search]);

  const validate = () => {
    const e: Record<string, string> = {};
    const parsed = parseQuantityInput(form.quantity);
    if (parsed.error) {
      e.quantity = "Số lượng không hợp lệ (phải từ 0 trở lên).";
    }
    if (parsed.error) e.quantity = parsed.error;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!editId) {
      showToast("ℹ️ Vui lòng chỉnh sửa hàng có sẵn. Tính năng thêm mặt hàng mới được quản lý bởi Hệ Thống chính.");
      setShowModal(false);
      return;
    }

    try {
      const parsed = parseQuantityInput(form.quantity);
      if (parsed.value === null) {
        setErrors({ quantity: parsed.error || "Số lượng không hợp lệ." });
        return;
      }

      const qty = parsed.value;
      const actionReason = reason.trim() || "Cập nhật số lượng tồn kho từ Trang Quản lý";

      await managerService.stockCheckInventory(branchId, {
        inventoryItemId: editId,
        actualQuantity: qty,
        reason: actionReason
      });
      showToast("✓ Đã điều chỉnh số lượng tồn kho thành công");

      setShowModal(false);
      setEditId(null);
      setReason("");
      setErrors({});
      void loadInventory();
    } catch (err: unknown) {
      showToast(`Lỗi: ${getErrorMessage(err, "Không thể cập nhật tồn kho.")}`);
    }
  };

  const openEdit = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: String(item.quantity),
      minThreshold: String(item.minThreshold),
      maxStock: String(item.maxStock),
    });
    setEditId(itemId);
    setReason("");
    setShowModal(true);
    setErrors({});
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Quản lý kho hàng</h1>
          <p className="text-xs text-on-surface-variant mt-1">Giám sát nguyên vật liệu tại chi nhánh và tra cứu định lượng vật tư liệu trình.</p>
        </div>

        {/* Tabs Switcher */}
        <div className="flex bg-surface-container-low p-1.5 rounded-full border border-outline-variant/30 self-start sm:self-center">
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-5 py-2 rounded-full font-label-md text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "stock"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Quản lý kho hàng
          </button>
          <button
            onClick={() => setActiveTab("requirements")}
            className={`px-5 py-2 rounded-full font-label-md text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "requirements"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Định lượng liệu trình
          </button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && activeTab === "stock" && (
        <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-pulse">
          <span className="material-symbols-outlined text-error text-[22px]">warning</span>
          <p className="font-label-md text-label-md text-error font-bold text-sm">
            {lowStock.length} mặt hàng dưới ngưỡng tối thiểu: {lowStock.map((i) => i.name).join(", ")}
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <input
          className="w-full border border-outline-variant/60 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-primary bg-white text-sm transition-all"
          placeholder={activeTab === "stock" ? "Tìm kiếm mặt hàng theo tên hoặc danh mục..." : "Tìm kiếm định lượng theo tên dịch vụ..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="material-symbols-outlined absolute left-3 top-3.5 text-on-surface-variant text-[18px]">search</span>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="text-center py-12 text-on-surface-variant text-sm font-medium">Đang tải dữ liệu...</div>
      ) : activeTab === "stock" ? (
        /* Inventory Table Tab */
        <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr>
                {["Tên hàng", "Danh mục", "Tồn kho", "Tiến độ", "Ngưỡng / Tối đa", "Kiểm kho cuối", "Hành động"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3.5 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-xs font-bold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-on-surface-variant italic">
                    Không tìm thấy mặt hàng nào trong kho.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const pct = Math.min(100, Math.round((item.quantity / item.maxStock) * 100));
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-surface-container-lowest transition-colors ${
                        item.isLow ? "bg-error-container/5" : ""
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-4">
                        <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{item.name}</p>
                        {item.isLow && (
                          <span className="text-[11px] text-error font-bold flex items-center gap-0.5 mt-0.5">
                            <span className="material-symbols-outlined text-[12px]">warning</span>Sắp hết hàng
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4 font-label-sm text-label-sm text-on-surface-variant text-xs font-semibold">
                        {item.category}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-4">
                        <span className={`font-bold text-base ${item.isLow ? "text-error font-extrabold" : "text-on-surface"}`}>
                          {item.quantity}
                        </span>
                        <span className="text-on-surface-variant text-xs font-medium"> {item.unit}</span>
                      </td>

                      {/* Progress Bar */}
                      <td className="px-4 py-4 w-32">
                        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.isLow ? "bg-error" : pct > 60 ? "bg-primary" : pct > 20 ? "bg-amber-500" : "bg-secondary"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 font-bold">{pct}%</p>
                      </td>

                      {/* Thresholds */}
                      <td className="px-4 py-4 text-xs text-on-surface-variant font-medium">
                        {item.minThreshold} / {item.maxStock}
                      </td>

                      {/* Last Restocked / Checked */}
                      <td className="px-4 py-4 font-label-sm text-label-sm text-on-surface-variant text-xs">
                        {item.lastRestocked}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openEdit(item.id)}
                          className="px-3.5 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-colors flex items-center gap-1"
                          title="Điều chỉnh số lượng"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Điều chỉnh
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Requirements (Recipes) Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRequirements.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-on-surface-variant text-xs italic bg-white border border-outline-variant/20 rounded-2xl">
              Không tìm thấy thông tin định lượng liệu trình nào.
            </div>
          ) : (
            filteredRequirements.map((gr) => (
              <div
                key={gr.serviceId}
                className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-2.5 mb-3.5">
                    <span className="material-symbols-outlined text-primary text-[20px] bg-primary/10 p-1.5 rounded-lg">spa</span>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm leading-snug">{gr.serviceName}</h3>
                      <p className="text-[11px] text-stone-500">Mã liệu trình dịch vụ: #{gr.serviceId}</p>
                    </div>
                  </div>

                  <div className="border-t border-outline-variant/10 pt-3 space-y-2">
                    <h4 className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Vật tư cần sử dụng:</h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {gr.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-stone-50 p-2 rounded-lg text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="font-medium text-stone-700 truncate max-w-[200px]">{i.name}</span>
                          </div>
                          <div className="font-bold text-stone-950 bg-stone-200/50 px-2 py-0.5 rounded text-[11px]">
                            {i.quantity} {i.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-outline-variant/10 pt-3 mt-4 text-[11px] text-on-surface-variant flex items-center gap-1 font-medium italic">
                  <span className="material-symbols-outlined text-xs">info</span>
                  Khấu trừ tự động vào kho khi buổi liệu trình kết thúc.
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[22px]">inventory</span>
                Kiểm kê số lượng
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrors({});
                }}
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] hover:text-stone-900 transition-colors">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 text-xs font-bold">
                  Tên mặt hàng
                </label>
                <input
                  className="w-full border border-outline-variant/60 rounded-lg px-3 py-2 text-sm bg-stone-50 text-on-surface-variant font-medium"
                  disabled
                  value={form.name}
                />
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 text-xs font-bold">
                  Số lượng thực tế trong kho ({form.unit})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ví dụ: 8 hoặc 8.011"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors ${
                    errors.quantity ? "border-error" : "border-outline-variant/80"
                  }`}
                  value={form.quantity}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, quantity: e.target.value.trim() }));
                    setErrors((p) => ({ ...p, quantity: "" }));
                  }}
                />
                {errors.quantity && (
                  <p className="text-error text-[11px] mt-1 font-semibold">{errors.quantity}</p>
                )}
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 text-xs font-bold">
                  Lý do điều chỉnh
                </label>
                <textarea
                  className="w-full border border-outline-variant/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors min-h-[60px]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do kiểm kê kho (không bắt buộc)..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold transition-opacity shadow-sm"
              >
                Cập nhật
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrors({});
                }}
                className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container font-semibold transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
