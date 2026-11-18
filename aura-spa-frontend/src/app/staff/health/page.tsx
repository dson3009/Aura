"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { bookingService } from "@/lib/services/booking.service";
import { staffService } from "@/lib/services/staff.service";
import type { Booking, HealthRecord } from "@/lib/types";

type BranchCustomer = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastService: string;
  lastVisitAt: string;
  visitCount: number;
};

type HealthForm = {
  skinType: string;
  allergies: string;
  medicalConditions: string;
  contraindications: string;
  notes: string;
};

const SERVED_STATUSES = new Set<Booking["status"]>([
  "checked_in",
  "in_service",
  "service_completed",
  "completed",
]);

function emptyForm(): HealthForm {
  return {
    skinType: "",
    allergies: "",
    medicalConditions: "",
    contraindications: "",
    notes: "",
  };
}

function formFromRecord(record: HealthRecord | null): HealthForm {
  return {
    skinType: record?.skinType || "",
    allergies: record?.allergies || "",
    medicalConditions: record?.medicalConditions || "",
    contraindications: record?.contraindications || "",
    notes: record?.notes || "",
  };
}

function primaryService(booking: Booking) {
  return booking.services?.[0]?.service?.name || "Dịch vụ spa";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildCustomers(bookings: Booking[]) {
  const customers = new Map<string, BranchCustomer>();

  for (const booking of bookings) {
    if (!booking.customerId || !SERVED_STATUSES.has(booking.status)) continue;
    const existing = customers.get(booking.customerId);
    const currentVisitTime = new Date(booking.startTime).getTime();
    const existingVisitTime = existing ? new Date(existing.lastVisitAt).getTime() : -Infinity;

    if (!existing) {
      customers.set(booking.customerId, {
        customerId: booking.customerId,
        customerName: booking.customer?.fullName || "Khách hàng",
        customerPhone: booking.customer?.phone || "",
        lastService: primaryService(booking),
        lastVisitAt: booking.startTime,
        visitCount: 1,
      });
      continue;
    }

    existing.visitCount += 1;
    if (currentVisitTime > existingVisitTime) {
      existing.customerName = booking.customer?.fullName || existing.customerName;
      existing.customerPhone = booking.customer?.phone || existing.customerPhone;
      existing.lastService = primaryService(booking);
      existing.lastVisitAt = booking.startTime;
    }
  }

  return Array.from(customers.values()).sort(
    (a, b) => new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime()
  );
}

export default function StaffHealth() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";
  const [customers, setCustomers] = useState<BranchCustomer[]>([]);
  const [records, setRecords] = useState<Record<string, HealthRecord | null>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<HealthForm>(() => emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  };

  const loadCustomers = useCallback(async () => {
    if (!branchId) {
      setCustomers([]);
      setRecords({});
      setLoadError("Không xác định được chi nhánh của tài khoản.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError("");
    try {
      const bookings = await bookingService.getBranchBookings(branchId, undefined, undefined, undefined, 200);
      const nextCustomers = buildCustomers(bookings || []);
      setCustomers(nextCustomers);
      setSelected((current) => {
        if (current && nextCustomers.some((customer) => customer.customerId === current)) return current;
        return nextCustomers[0]?.customerId ?? null;
      });

      const pairs = await Promise.all(
        nextCustomers.map(async (customer) => {
          try {
            const healthRecords = await staffService.getHealthRecords(customer.customerId);
            const branchRecord =
              healthRecords.find((record) => record.branchId === branchId) ?? healthRecords[0] ?? null;
            return [customer.customerId, branchRecord] as const;
          } catch {
            return [customer.customerId, null] as const;
          }
        })
      );
      setRecords(Object.fromEntries(pairs));
    } catch (err) {
      setCustomers([]);
      setRecords({});
      setSelected(null);
      setLoadError(err instanceof Error ? err.message : "Không tải được danh sách khách tại cơ sở.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadCustomers(), 0);
    return () => window.clearTimeout(id);
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) =>
      customer.customerName.toLowerCase().includes(keyword) ||
      customer.customerPhone.toLowerCase().includes(keyword)
    );
  }, [customers, search]);

  const rec = selected ? records[selected] ?? null : null;
  const selectedCustomer = customers.find((customer) => customer.customerId === selected);

  const startEdit = () => {
    setForm(formFromRecord(rec));
    setErrors({});
    setEditMode(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.skinType.trim()) nextErrors.skinType = "Vui lòng nhập loại da.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!selected || !branchId || !validate()) return;
    setIsSaving(true);
    try {
      const updated = await staffService.upsertHealthRecord(selected, {
        branchId,
        skinType: form.skinType.trim() || undefined,
        allergies: form.allergies.trim() || undefined,
        medicalConditions: form.medicalConditions.trim() || undefined,
        contraindications: form.contraindications.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setRecords((prev) => ({ ...prev, [selected]: updated }));
      setForm(formFromRecord(updated));
      setEditMode(false);
      showToast("✓ Hồ sơ sức khỏe đã được cập nhật thành công");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Cập nhật hồ sơ sức khỏe thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <h1 className="font-headline-md text-headline-md text-primary mb-2">Hồ sơ sức khỏe khách hàng</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        Xem và cập nhật hồ sơ của khách đã từng được phục vụ tại cơ sở này.
      </p>

      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 20 }}>search</span>
        <input
          className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-xl bg-white focus:outline-none focus:border-primary transition-colors"
          placeholder="Tìm khách hàng theo tên hoặc SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
            Khách đã phục vụ tại cơ sở
          </h2>
          {isLoading ? (
            <p className="text-center text-on-surface-variant py-8 font-label-md text-label-md">Đang tải danh sách khách...</p>
          ) : (
            filteredCustomers.map((customer) => {
              const hasRecord = Boolean(records[customer.customerId]);
              return (
                <button
                  type="button"
                  key={customer.customerId}
                  onClick={() => { setSelected(customer.customerId); setEditMode(false); }}
                  className={`w-full text-left bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                    selected === customer.customerId ? "border-primary bg-primary/5" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                      {customer.customerName.split(" ").pop()?.[0] ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-label-md text-on-surface font-bold truncate">{customer.customerName}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{customer.customerPhone || "Chưa có SĐT"}</p>
                    </div>
                    {hasRecord ? (
                      <span className="material-symbols-outlined text-green-600 shrink-0" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 18 }}>add_circle</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant truncate">{customer.visitCount} lượt · Gần nhất: {customer.lastService}</p>
                </button>
              );
            })
          )}
          {!isLoading && filteredCustomers.length === 0 && (
            <p className="text-center text-on-surface-variant py-8 font-label-md text-label-md">
              Không tìm thấy khách đã phục vụ tại cơ sở
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          {selected && selectedCustomer ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-outline-variant/20 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0">
                    {selectedCustomer.customerName.split(" ").pop()?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-headline-sm text-headline-sm text-on-surface truncate">{selectedCustomer.customerName}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                      {selectedCustomer.customerPhone || "Chưa có SĐT"} · {selectedCustomer.visitCount} lượt tại cơ sở
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                      Gần nhất: {formatDateTime(selectedCustomer.lastVisitAt)} · {selectedCustomer.lastService}
                    </p>
                  </div>
                </div>
                {!editMode && (
                  <button
                    onClick={startEdit}
                    className="flex items-center justify-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md text-sm hover:opacity-90 shrink-0"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    {rec ? "Chỉnh sửa" : "Tạo hồ sơ"}
                  </button>
                )}
              </div>

              {editMode ? (
                <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 space-y-5">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Cập nhật hồ sơ sức khỏe</h3>
                  {[
                    { label: "Loại da *", key: "skinType", placeholder: "VD: Da dầu hỗn hợp, da khô nhạy cảm..." },
                    { label: "Dị ứng & chất kỵ", key: "allergies", placeholder: "VD: Dị ứng tinh dầu hạt, không dùng paraben..." },
                    { label: "Tình trạng y tế", key: "medicalConditions", placeholder: "VD: Huyết áp cao, tiểu đường nhẹ..." },
                    { label: "Chống chỉ định", key: "contraindications", placeholder: "VD: Tránh massage áp lực mạnh, tránh nhiệt cao..." },
                    { label: "Ghi chú & ưu tiên", key: "notes", placeholder: "VD: Nhiệt độ phòng 25°C, nhạc nhẹ, KTV ưu tiên..." },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">{label}</label>
                      <textarea
                        rows={2}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none ${errors[key] ? "border-error" : "border-outline-variant"}`}
                        placeholder={placeholder}
                        value={form[key as keyof HealthForm]}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, [key]: e.target.value }));
                          setErrors((prev) => ({ ...prev, [key]: "" }));
                        }}
                      />
                      {errors[key] && <p className="text-error text-xs mt-1">{errors[key]}</p>}
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 disabled:opacity-60"
                    >
                      {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : rec ? (
                <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 space-y-4">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Hồ sơ sức khỏe</h3>
                  {[
                    { label: "Loại da", value: rec.skinType, warn: false },
                    { label: "Dị ứng & chất kỵ", value: rec.allergies, warn: true },
                    { label: "Tình trạng y tế", value: rec.medicalConditions, warn: Boolean(rec.medicalConditions) },
                    { label: "Chống chỉ định", value: rec.contraindications, warn: Boolean(rec.contraindications) },
                    { label: "Ghi chú & ưu tiên", value: rec.notes, warn: false },
                  ].map(({ label, value, warn }) => (
                    <div key={label} className={`p-4 rounded-xl ${warn ? "bg-error-container/10 border border-error-container/40" : "bg-surface-container-low"}`}>
                      <p className={`font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold flex items-center gap-1 ${warn ? "text-error" : "text-on-surface-variant"}`}>
                        {warn && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>}
                        {label}
                      </p>
                      <p className="text-sm text-on-surface">{value || "Không"}</p>
                    </div>
                  ))}
                  <p className="text-xs text-on-surface-variant border-t border-outline-variant/20 pt-3">
                    Cập nhật lần cuối: {new Date(rec.updatedAt).toLocaleDateString("vi-VN")}
                    {rec.updatedBy ? ` · bởi ${rec.updatedBy}` : ""}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-outline-variant text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl block mb-3 text-outline">medical_information</span>
                  <p className="font-label-md text-label-md font-bold mb-1">Chưa có hồ sơ sức khỏe</p>
                  <p className="font-label-sm text-label-sm mb-4">Tạo hồ sơ để đảm bảo an toàn điều trị cho khách hàng này.</p>
                  <button onClick={startEdit} className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md text-label-md hover:opacity-90 text-sm">
                    Tạo hồ sơ ngay
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-2 text-outline">health_and_safety</span>
              <p className="font-label-md text-label-md">Chọn khách hàng để xem hồ sơ sức khỏe</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
