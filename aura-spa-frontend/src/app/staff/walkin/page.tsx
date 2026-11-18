"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spaService } from "@/lib/services/spa.service";
import { staffService } from "@/lib/services/staff.service";
import type { Booking, Branch, BranchTechnician, SpaService } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

interface WalkInForm {
  customerName: string;
  customerPhone: string;
  branchId: string;
  serviceId: string;
  technicianId: string;
  time: string;
  notes: string;
}

const emptyForm: WalkInForm = {
  customerName: "",
  customerPhone: "",
  branchId: "",
  serviceId: "",
  technicianId: "",
  time: "",
  notes: "",
};

function toNumber(value: number | string) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number | string) {
  return `${toNumber(value).toLocaleString("vi-VN")}đ`;
}

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeInput() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return `${date.getHours()}`.padStart(2, "0") + ":" + `${date.getMinutes()}`.padStart(2, "0");
}

function buildStartTime(time: string) {
  return `${toLocalDateInput(new Date())}T${time}:00+07:00`;
}

function normalizeVietnamPhone(phone: string) {
  const compact = phone.replace(/[^\d+]/g, "");
  if (/^\+84\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^84\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

function phoneIsValid(phone: string) {
  return /^0[0-9]{9}$/.test(normalizeVietnamPhone(phone));
}

export default function StaffWalkIn() {
  const { tService } = useLanguage();
  const { user } = useAuth();
  const [form, setForm] = useState<WalkInForm>({ ...emptyForm, time: currentTimeInput() });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<SpaService[]>([]);
  const [technicians, setTechnicians] = useState<BranchTechnician[]>([]);
  const [created, setCreated] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WalkInForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const today = toLocalDateInput(new Date());
      const [timetable, branchData, serviceData] = await Promise.all([
        staffService.getTimetable(today, today),
        spaService.getBranches(),
        spaService.getServices(),
      ]);

      const staffBranchId = user?.branchId ?? timetable[0]?.shifts[0]?.branchId ?? "";
      const visibleBranches = staffBranchId
        ? branchData.filter((branch) => branch.id === staffBranchId)
        : branchData;

      setBranches(visibleBranches);
      setServices(serviceData);
      setForm((current) => ({
        ...current,
        branchId: visibleBranches.some((branch) => branch.id === current.branchId)
          ? current.branchId
          : staffBranchId,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu tạo lịch vãng lai.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadInitialData(), 0);
    return () => window.clearTimeout(id);
  }, [loadInitialData]);

  useEffect(() => {
    let ignore = false;

    async function loadTechnicians() {
      if (!form.branchId) return;

      try {
        setIsLoadingTechnicians(true);
        const data = await spaService.getBranchTechnicians(form.branchId);
        if (!ignore) {
          setTechnicians(data);
          setForm((current) => ({
            ...current,
            technicianId: data.some((tech) => tech.user.id === current.technicianId) ? current.technicianId : "",
          }));
        }
      } catch (err) {
        if (!ignore) {
          setTechnicians([]);
          setError(err instanceof Error ? err.message : "Không tải được kỹ thuật viên của chi nhánh.");
        }
      } finally {
        if (!ignore) setIsLoadingTechnicians(false);
      }
    }

    loadTechnicians();

    return () => {
      ignore = true;
    };
  }, [form.branchId]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId),
    [form.serviceId, services]
  );
  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId),
    [branches, form.branchId]
  );
  const selectedTechnician = useMemo(
    () => technicians.find((tech) => tech.user.id === form.technicianId),
    [technicians, form.technicianId]
  );

  const validate = () => {
    const nextErrors: Partial<Record<keyof WalkInForm, string>> = {};
    if (!form.customerName.trim()) nextErrors.customerName = "Vui lòng nhập tên khách hàng.";
    if (!form.customerPhone.trim()) nextErrors.customerPhone = "Vui lòng nhập số điện thoại.";
    else if (!phoneIsValid(form.customerPhone)) nextErrors.customerPhone = "Số điện thoại không hợp lệ.";
    if (!form.branchId) nextErrors.branchId = "Không xác định được chi nhánh.";
    if (!form.serviceId) nextErrors.serviceId = "Vui lòng chọn dịch vụ.";
    if (!form.time) nextErrors.time = "Vui lòng chọn giờ bắt đầu.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateForm = (key: keyof WalkInForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleCreate = async () => {
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const customerPhone = normalizeVietnamPhone(form.customerPhone);
      const booking = await staffService.createWalkInBooking({
        customerName: form.customerName.trim(),
        customerPhone,
        branchId: form.branchId,
        serviceId: form.serviceId,
        technicianId: form.technicianId || undefined,
        startTime: buildStartTime(form.time),
        notes: form.notes.trim() || undefined,
      });

      setCreated(booking);
      showToast("Đã tạo lịch vãng lai và check-in khách");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tạo được lịch vãng lai.";
      if (
        message.includes("So dien thoai nay dang thuoc tai khoan noi bo") ||
        message.includes("Tai khoan khach hang dung so dien thoai nay")
      ) {
        const phoneMessage = message.includes("So dien thoai nay dang thuoc tai khoan noi bo")
          ? "Số điện thoại này đang thuộc tài khoản nội bộ. Vui lòng dùng số khác."
          : "Tài khoản khách hàng dùng số điện thoại này đang bị khóa hoặc chưa hoạt động.";
        setErrors((current) => ({ ...current, customerPhone: phoneMessage }));
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setForm((current) => ({
      ...emptyForm,
      branchId: current.branchId,
      time: currentTimeInput(),
    }));
    setErrors({});
    setCreated(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-on-surface-variant">
        Đang tải dữ liệu tạo lịch vãng lai...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">Tạo lịch hẹn tại quầy</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Dành cho khách đến trực tiếp. Hệ thống sẽ tìm khách theo SĐT hoặc tạo nhanh tài khoản customer.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
          {error}
        </div>
      )}

      {created ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-green-600" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>
                event_available
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Lịch vãng lai đã được tạo</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Mã booking: #{created.id}</p>
          </div>

          <div className="bg-surface-container-low rounded-xl p-5 space-y-3 mb-6 text-sm">
            {[
              { icon: "person", label: "Khách hàng", value: form.customerName },
              { icon: "phone", label: "SĐT", value: form.customerPhone },
              { icon: "location_on", label: "Chi nhánh", value: selectedBranch?.name ?? created.branchId },
              { icon: "spa", label: "Dịch vụ", value: selectedService?.name ?? created.services[0]?.serviceId ?? "Dịch vụ spa" },
              { icon: "schedule", label: "Giờ", value: form.time },
              { icon: "badge", label: "KTV", value: selectedTechnician?.user.fullName ?? "Hệ thống tự phân công" },
              { icon: "payments", label: "Tạm tính", value: formatCurrency(created.remainingAmount) },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
                <span className="text-on-surface-variant w-24 shrink-0">{label}</span>
                <span className="font-bold text-on-surface">{value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`/staff/invoice?bookingId=${created.id}`} className="btn-primary text-center">
              Tạo hóa đơn & QR thanh toán
            </Link>
            <button onClick={reset} className="w-full border border-primary text-primary hover:bg-primary/5 py-3 rounded-full font-label-md text-label-md font-bold transition-all">
              Tạo lịch hẹn mới
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-6">
          <section className="pb-5 border-b border-outline-variant/10">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              Thông tin khách hàng
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  Họ và tên *
                </label>
                <input
                  className={`custom-input w-full ${errors.customerName ? "border-error" : ""}`}
                  placeholder="Nguyễn Văn A"
                  value={form.customerName}
                  onChange={(event) => updateForm("customerName", event.target.value)}
                />
                {errors.customerName && <p className="text-error text-xs mt-1">{errors.customerName}</p>}
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  Số điện thoại *
                </label>
                <input
                  className={`custom-input w-full ${errors.customerPhone ? "border-error" : ""}`}
                  placeholder="0912345678"
                  type="tel"
                  value={form.customerPhone}
                  onChange={(event) => updateForm("customerPhone", event.target.value)}
                />
                {errors.customerPhone && <p className="text-error text-xs mt-1">{errors.customerPhone}</p>}
              </div>
            </div>
          </section>

          <section className="pb-5 border-b border-outline-variant/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  Chi nhánh *
                </label>
                <select
                  className={`custom-input w-full ${errors.branchId ? "border-error" : ""}`}
                  value={form.branchId}
                  onChange={(event) => updateForm("branchId", event.target.value)}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {tService(branch.name)}
                    </option>
                  ))}
                </select>
                {errors.branchId && <p className="text-error text-xs mt-1">{errors.branchId}</p>}
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  Giờ bắt đầu *
                </label>
                <input
                  className={`custom-input w-full ${errors.time ? "border-error" : ""}`}
                  type="time"
                  value={form.time}
                  onChange={(event) => updateForm("time", event.target.value)}
                />
                {errors.time && <p className="text-error text-xs mt-1">{errors.time}</p>}
              </div>
            </div>
          </section>

          <section className="pb-5 border-b border-outline-variant/10">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              Dịch vụ *
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {services.map((service) => (
                <label
                  key={service.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.serviceId === service.id
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.serviceId === service.id}
                    onChange={() => updateForm("serviceId", service.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm leading-tight">{tService(service.name)}</p>
                    <p className="text-xs text-on-surface-variant">
                      {service.defaultDurationMinutes} phút · {formatCurrency(service.defaultPrice)}
                    </p>
                  </div>
                  {form.serviceId === service.id && (
                    <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  )}
                </label>
              ))}
            </div>
            {errors.serviceId && <p className="text-error text-xs mt-1">{errors.serviceId}</p>}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                Kỹ thuật viên
              </label>
              <select
                className="custom-input w-full"
                value={form.technicianId}
                onChange={(event) => updateForm("technicianId", event.target.value)}
                disabled={isLoadingTechnicians}
              >
                <option value="">Hệ thống tự phân công</option>
                {technicians.map((tech) => (
                  <option key={tech.user.id} value={tech.user.id}>
                    {tech.user.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                Ghi chú
              </label>
              <input
                className="custom-input w-full"
                placeholder="VD: Khách đến trực tiếp, cần tư vấn nhanh..."
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
              />
            </div>
          </section>

          {selectedService && (
            <div className="bg-surface-container-low rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-label-md text-label-md text-on-surface font-bold">{tService(selectedService.name)}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {form.time || "Chưa chọn giờ"} · {selectedService.defaultDurationMinutes} phút · {selectedBranch ? tService(selectedBranch.name) : "Chưa chọn chi nhánh"}
                </p>
              </div>
              <p className="font-headline-sm text-headline-sm text-primary font-bold">
                {formatCurrency(selectedService.defaultPrice)}
              </p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="w-full btn-primary py-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Đang tạo lịch..." : "Tạo lịch hẹn & check-in ngay"}
          </button>
        </div>
      )}
    </div>
  );
}
