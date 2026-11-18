"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { bookingService } from "@/lib/services/booking.service";
import { staffService } from "@/lib/services/staff.service";
import type { Booking, HealthRecord } from "@/lib/types";

type CustomerAppointment = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  service: string;
  technicianName: string;
  time: string;
  room: string;
  status: Booking["status"];
  price: number;
};

type HealthForm = {
  skinType: string;
  allergies: string;
  medicalConditions: string;
  contraindications: string;
  notes: string;
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatCurrency(value: number | string) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function statusColor(status: string) {
  if (status === "completed" || status === "service_completed") return "bg-green-50 text-green-700";
  if (status === "checked_in" || status === "in_service") return "bg-primary/10 text-primary";
  if (status === "cancelled" || status === "no_show") return "bg-red-50 text-red-700";
  if (status === "pending_payment") return "bg-amber-50 text-amber-800";
  return "bg-blue-50 text-blue-700";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "Chờ cọc",
    confirmed: "Đã xác nhận",
    checked_in: "Đã tiếp nhận",
    in_service: "Đang phục vụ",
    service_completed: "Xong dịch vụ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    no_show: "Không đến",
    rescheduled: "Đổi lịch",
    transferred: "Chuyển chi nhánh",
  };
  return labels[status] || status;
}

function mapBookingToAppointment(booking: Booking): CustomerAppointment {
  const firstService = booking.services?.[0];
  return {
    id: booking.id,
    customerId: booking.customerId,
    customerName: booking.customer?.fullName || "Khách hàng",
    customerPhone: booking.customer?.phone || "",
    service: firstService?.service?.name || "Dịch vụ spa",
    technicianName: booking.technician?.fullName || "Chưa phân công",
    time: formatTime(booking.startTime),
    room: booking.room || "Chưa phân phòng",
    status: booking.status,
    price: Number(booking.subtotalAmount) || Number(firstService?.finalAmount) || 0,
  };
}

function emptyHealthForm(): HealthForm {
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

export default function StaffCustomers() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [form, setForm] = useState<HealthForm>(() => emptyHealthForm());
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  };

  const loadAppointments = useCallback(async () => {
    if (!branchId) {
      setError("Không xác định được chi nhánh của tài khoản.");
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const bookings = await bookingService.getBranchBookings(branchId, todayInputValue());
      const mapped = (bookings || [])
        .filter((booking) => booking.customerId)
        .map(mapBookingToAppointment)
        .sort((a, b) => a.time.localeCompare(b.time));
      setAppointments(mapped);
      setSelected((current) => {
        if (current && mapped.some((item) => item.customerId === current)) return current;
        return mapped[0]?.customerId ?? null;
      });
    } catch (err) {
      setAppointments([]);
      setSelected(null);
      setError(err instanceof Error ? err.message : "Không tải được danh sách khách hàng hôm nay.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadAppointments(), 0);
    return () => window.clearTimeout(id);
  }, [loadAppointments]);

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      if (!selected) {
        setHealthRecord(null);
        setForm(emptyHealthForm());
        return;
      }

      setIsHealthLoading(true);
      setEditMode(false);
      staffService
        .getHealthRecords(selected)
        .then((records) => {
          if (!active) return;
          const record = records?.[0] ?? null;
          setHealthRecord(record);
          setForm(formFromRecord(record));
        })
        .catch((err) => {
          if (!active) return;
          setHealthRecord(null);
          setForm(emptyHealthForm());
          showToast(err instanceof Error ? err.message : "Không tải được hồ sơ sức khỏe");
        })
        .finally(() => {
          if (active) setIsHealthLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [selected]);

  const customers = useMemo(() => {
    const unique = new Map<string, CustomerAppointment>();
    for (const appointment of appointments) {
      if (!unique.has(appointment.customerId)) unique.set(appointment.customerId, appointment);
    }

    const keyword = search.trim().toLowerCase();
    return Array.from(unique.values()).filter((item) => {
      if (!keyword) return true;
      return (
        item.customerName.toLowerCase().includes(keyword) ||
        item.customerPhone.toLowerCase().includes(keyword)
      );
    });
  }, [appointments, search]);

  const selectedAppt = appointments.find((item) => item.customerId === selected);
  const allAppts = appointments.filter((item) => item.customerId === selected);

  const startEdit = () => {
    setForm(formFromRecord(healthRecord));
    setEditMode(true);
  };

  const saveHealth = async () => {
    if (!selected || !branchId) return;
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
      setHealthRecord(updated);
      setForm(formFromRecord(updated));
      setEditMode(false);
      showToast("✓ Đã cập nhật hồ sơ sức khỏe");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Cập nhật hồ sơ sức khỏe thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <h1 className="font-headline-md text-headline-md text-primary mb-6">Khách hàng hôm nay</h1>

      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 20 }}>search</span>
        <input
          className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-xl bg-white focus:outline-none focus:border-primary transition-colors"
          placeholder="Tìm theo tên hoặc số điện thoại..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            <p className="text-center text-on-surface-variant py-8 font-label-md text-label-md">Đang tải khách hàng...</p>
          ) : (
            customers.map((a) => (
              <button
                type="button"
                key={a.customerId}
                onClick={() => { setSelected(a.customerId); setEditMode(false); }}
                className={`w-full text-left p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selected === a.customerId ? "border-primary bg-primary/5" : "border-outline-variant/30 bg-white hover:border-outline-variant"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                    {a.customerName.split(" ").pop()?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-bold truncate">{a.customerName}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{a.customerPhone || "Chưa có SĐT"}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-on-surface-variant truncate">{a.service}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(a.status)}`}>
                    {statusLabel(a.status)}
                  </span>
                </div>
              </button>
            ))
          )}
          {!isLoading && customers.length === 0 && (
            <p className="text-center text-on-surface-variant py-8 font-label-md text-label-md">
              Không có khách hàng hôm nay
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          {selected && selectedAppt ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 border border-outline-variant/20">
                <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{selectedAppt.customerName}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-on-surface-variant mb-1 font-bold uppercase text-xs">Điện thoại</p>
                    <p>{selectedAppt.customerPhone || "Chưa có SĐT"}</p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant mb-1 font-bold uppercase text-xs">Số lịch hôm nay</p>
                    <p>{allAppts.length} lịch</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {allAppts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-4 p-3 bg-surface-container-low rounded-lg">
                      <div className="min-w-0">
                        <p className="font-label-md text-label-md text-on-surface font-bold truncate">{a.time} - {a.service}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">KTV: {a.technicianName} · {a.room}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
                        <p className="font-label-sm text-label-sm text-primary font-bold mt-1">{formatCurrency(a.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-5 border-b border-outline-variant/20 bg-surface-container-low/40">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>health_and_safety</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight">Hồ sơ sức khỏe</h3>
                      <p className="text-xs text-on-surface-variant mt-1">Thông tin lưu ý trước khi phục vụ khách</p>
                    </div>
                  </div>
                  {!editMode && !isHealthLoading && (
                    <button
                      onClick={startEdit}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-4 py-2 text-primary font-label-md text-label-md hover:bg-primary/5 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                      {healthRecord ? "Chỉnh sửa" : "Thêm mới"}
                    </button>
                  )}
                </div>

                <div className="p-6">
                  {isHealthLoading ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/30 px-4 py-8 text-center">
                      <span className="material-symbols-outlined text-outline mb-2 block" style={{ fontSize: 32 }}>hourglass_empty</span>
                      <p className="text-on-surface-variant font-label-md text-label-md">Đang tải hồ sơ sức khỏe...</p>
                    </div>
                  ) : editMode ? (
                    <div className="space-y-4">
                    {[
                      { label: "Loại da", key: "skinType", placeholder: "Da dầu, da khô, da hỗn hợp..." },
                      { label: "Dị ứng", key: "allergies", placeholder: "Các thành phần dị ứng..." },
                      { label: "Tình trạng y tế", key: "medicalConditions", placeholder: "Bệnh lý, lưu ý sức khỏe..." },
                      { label: "Chống chỉ định", key: "contraindications", placeholder: "Các thao tác hoặc liệu trình cần tránh..." },
                      { label: "Ghi chú", key: "notes", placeholder: "Sở thích, nhiệt độ phòng, KTV ưu tiên..." },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">{label}</label>
                        <textarea
                          className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                          rows={2}
                          placeholder={placeholder}
                          value={form[key as keyof HealthForm]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <div className="flex gap-3">
                      <button
                        onClick={saveHealth}
                        disabled={isSaving}
                        className="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 disabled:opacity-60"
                      >
                        {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="border border-outline-variant px-6 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
                      >
                        Hủy
                      </button>
                    </div>
                    </div>
                  ) : healthRecord ? (
                    <div className="space-y-3">
                    {[
                      { label: "Loại da", value: healthRecord.skinType },
                      { label: "Dị ứng", value: healthRecord.allergies, highlight: true },
                      { label: "Tình trạng y tế", value: healthRecord.medicalConditions },
                      { label: "Chống chỉ định", value: healthRecord.contraindications, highlight: true },
                      { label: "Ghi chú", value: healthRecord.notes },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className={`p-3 rounded-lg ${highlight ? "bg-error-container/10 border border-error-container/30" : "bg-surface-container-low"}`}>
                        <p className={`font-bold text-xs uppercase mb-1 ${highlight ? "text-error" : "text-on-surface-variant"}`}>{label}</p>
                        <p className="text-sm text-on-surface">{value || "Không"}</p>
                      </div>
                    ))}
                    <p className="text-xs text-on-surface-variant">
                      Cập nhật lần cuối: {new Date(healthRecord.updatedAt).toLocaleDateString("vi-VN")}
                      {healthRecord.updatedBy ? ` bởi ${healthRecord.updatedBy}` : ""}
                    </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/30 px-4 py-8 text-center">
                      <span className="material-symbols-outlined text-outline mb-2 block" style={{ fontSize: 36 }}>medical_information</span>
                      <p className="font-label-md text-label-md text-on-surface">Chưa có hồ sơ sức khỏe</p>
                      <p className="text-xs text-on-surface-variant mt-1">Bấm “Thêm mới” để ghi nhận thông tin cho khách này.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-3 block text-outline">person_search</span>
              <p className="font-label-md text-label-md">Chọn khách hàng để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
