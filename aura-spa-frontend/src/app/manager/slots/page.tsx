"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";

const DEFAULT_SLOTS = [
  { time: "08:00", maxBookings: 3, duration: 60 },
  { time: "09:00", maxBookings: 3, duration: 60 },
  { time: "10:00", maxBookings: 3, duration: 60 },
  { time: "11:00", maxBookings: 2, duration: 60 },
  { time: "13:00", maxBookings: 3, duration: 60 },
  { time: "14:00", maxBookings: 3, duration: 60 },
  { time: "15:00", maxBookings: 3, duration: 60 },
  { time: "16:00", maxBookings: 2, duration: 60 },
  { time: "17:00", maxBookings: 2, duration: 60 },
  { time: "18:00", maxBookings: 2, duration: 60 },
  { time: "19:00", maxBookings: 1, duration: 60 },
];

const TRANSLATIONS = {
  vi: {
    title: "Cấu hình khung giờ",
    subtitle: "Cấu hình số lượng đặt lịch tối đa cho mỗi khung giờ để tránh quá tải. Thay đổi chỉ áp dụng cho đặt lịch mới.",
    saveBtn: "Lưu cấu hình",
    quickSetup: "Thiết lập nhanh tất cả",
    quickSetupDesc: "Cập nhật nhanh giá trị sức chứa và thời lượng cho tất cả khung giờ hiện tại.",
    quickSetupBtn: "Áp dụng nhanh",
    maxBookings: "Tối đa đặt lịch",
    duration: "Thời lượng",
    visual: "Trực quan",
    successMsg: "Cấu hình đã được áp dụng thành công",
    toastSaved: "✓ Cấu hình đã được lưu và áp dụng ngay cho đặt lịch trực tuyến.",
    toastError: "❌ Giới hạn tối thiểu là 1 lượt đặt / 30 phút.",
    infoTip: "Thay đổi chỉ ảnh hưởng đến đặt lịch mới. Các lịch hẹn đã xác nhận trước đó sẽ không bị ảnh hưởng.",
    timeSlot: "Khung giờ",
    minutes: "phút",
    capacityLabel: "Sức chứa tối đa",
    capacityUnit: "lượt",
    slotCount: "{val} lượt khách",
    activeSlots: "Lịch trực tuyến",
  },
  en: {
    title: "Time Slot Configuration",
    subtitle: "Configure the maximum booking capacity for each time slot to avoid overloading. Changes apply only to new bookings.",
    saveBtn: "Save Configuration",
    quickSetup: "Quick Batch Setup",
    quickSetupDesc: "Instantly update max capacity and booking duration across all current time slots.",
    quickSetupBtn: "Apply to All",
    maxBookings: "Max Bookings",
    duration: "Duration",
    visual: "Visual Slots",
    successMsg: "Configuration successfully applied",
    toastSaved: "✓ Configuration saved and applied immediately to online bookings.",
    toastError: "❌ Minimum limit is 1 booking / 30 minutes.",
    infoTip: "Changes only affect new bookings. Previously confirmed appointments remain unaffected.",
    timeSlot: "Time Slot",
    minutes: "mins",
    capacityLabel: "Max Capacity",
    capacityUnit: "slots",
    slotCount: "{val} slots",
    activeSlots: "Online Bookings",
  }
};

export default function ManagerSlots() {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "vi";
  const t = TRANSLATIONS[lang];

  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");

  // Batch setup local states
  const [batchMax, setBatchMax] = useState(3);
  const [batchDuration, setBatchDuration] = useState(60);

  const { user } = useAuth();
  const branchId = user?.branchId || "";
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().split("T")[0];
  });
  const [shifts, setShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  const loadShifts = useCallback(async () => {
    if (!branchId) return;
    setLoadingShifts(true);
    try {
      const list = await managerService.getScheduleRequests(branchId, "approved");
      setShifts(list || []);
    } catch (err) {
      console.error("Error loading approved shifts:", err);
    } finally {
      setLoadingShifts(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const updateSlot = (time: string, field: "maxBookings" | "duration", value: number) => {
    setSaved(false);
    setSlots((p) => p.map((s) => (s.time === time ? { ...s, [field]: value } : s)));
  };

  const handleSave = () => {
    const invalid = slots.find((s) => s.duration < 30);
    if (invalid) {
      showToast(
        lang === "en"
          ? "❌ Slot duration must be at least 30 minutes."
          : "❌ Thời lượng mỗi ca hẹn tối thiểu phải từ 30 phút."
      );
      return;
    }
    setSaved(true);
    showToast(t.toastSaved);
  };

  const handleBatchApply = () => {
    setSaved(false);
    setSlots((p) => p.map((s) => ({ ...s, duration: batchDuration })));
    showToast(
      lang === "en"
        ? `✓ Applied ${batchDuration} mins duration to all time slots.`
        : `✓ Đã áp dụng ${batchDuration} phút thời lượng cho tất cả khung giờ.`
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md animate-fade-in flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {toast}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">{t.title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={handleSave}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 self-start sm:self-center"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            save
          </span>
          {t.saveBtn}
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm font-bold shadow-sm">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          {t.successMsg}
        </div>
      )}

      {/* Date Picker Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-[22px]">calendar_month</span>
          <div>
            <h4 className="font-bold text-on-surface text-sm">{lang === "en" ? "Check Scheduled Staff by Date" : "Xem chi tiết ca trực thực tế"}</h4>
            <p className="text-xs text-on-surface-variant">{lang === "en" ? "Select a date to check scheduled technicians count per time slot." : "Chọn ngày để kiểm tra số lượng kỹ thuật viên rảnh tay của từng khung giờ."}</p>
          </div>
        </div>
        <input
          type="date"
          className="border border-outline-variant/60 rounded-xl px-4 py-2 text-sm font-bold text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary cursor-pointer"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Quick Setup Card */}
      <div className="bg-gradient-to-r from-surface-container-low to-surface-container border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </div>
          <div>
            <h3 className="font-bold text-on-surface font-label-md text-base">{t.quickSetup}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{lang === "en" ? "Update default duration across all current time slots." : "Cập nhật nhanh giá trị thời lượng ca cho tất cả khung giờ hiện tại."}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Duration field */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-outline-variant/40">
            <span className="text-xs font-semibold text-on-surface-variant">{t.duration}</span>
            <select
              value={batchDuration}
              onChange={(e) => setBatchDuration(+e.target.value)}
              className="text-sm font-bold text-on-surface bg-transparent focus:outline-none cursor-pointer"
            >
              {[30, 45, 60, 75, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} {t.minutes}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleBatchApply}
            className="bg-primary/10 text-primary hover:bg-primary hover:text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ml-auto sm:ml-0"
          >
            <span className="material-symbols-outlined text-[18px]">auto_fix</span>
            {t.quickSetupBtn}
          </button>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3 text-primary text-xs shadow-sm">
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
        <div>
          <p className="font-bold text-sm mb-1">
            {lang === "en" ? "Dynamic Roster-Based Capacity Active" : "ℹ️ Hệ thống tự động giới hạn sức chứa theo ca trực"}
          </p>
          <p className="leading-relaxed">
            {lang === "en"
              ? "All booking slot capacities are dynamically calculated in real-time based on the number of technicians registered for shifts on the selected date. No manual configuration is required for capacity."
              : "Sức chứa tối đa của các ca đặt lịch hiện đang được tự động tính toán dựa trên số lượng kỹ thuật viên đăng ký và được duyệt ca làm việc tại đúng khung giờ của ngày được chọn. Bạn chỉ cần cấu hình giờ mở cửa và thời lượng của mỗi ca hẹn."}
          </p>
        </div>
      </div>

      {/* Grid of Interactive Time Slot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {slots.map((slot) => {
          const slotStart = new Date(`${selectedDate}T${slot.time}:00+07:00`);
          const slotEnd = new Date(slotStart.getTime() + slot.duration * 60 * 1000);
          const scheduledTechs = shifts.filter((s: any) => {
            const start = new Date(s.requestedStart);
            const end = new Date(s.requestedEnd);
            return s.requestType === "work_shift" && start <= slotStart && end >= slotEnd;
          });
          const uniqueTechIds = new Set(scheduledTechs.map((s: any) => s.staffId || s.staff?.id || s.userId));
          const scheduledTechCount = uniqueTechIds.size;

          return (
            <div
              key={slot.time}
              className="bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm hover:shadow-md hover:border-primary/45 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Subtle Decorative Circle */}
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-primary/5 group-hover:scale-150 transition-transform duration-500" />

              <div>
                {/* Top Row: Time and Duration Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-primary/5 text-primary px-3 py-1.5 rounded-xl font-bold font-display text-lg flex items-center gap-2 border border-primary/10">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                    {slot.time}
                  </div>
                  <div className="bg-surface-container text-on-surface-variant px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/10">
                    <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                    {slot.duration} {t.minutes}
                  </div>
                </div>

                {/* Settings controls inside card */}
                <div className="space-y-4 my-4">
                   {/* Stepper Control for Max Bookings */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      {t.maxBookings}
                    </span>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20">
                      {lang === "en" ? "Auto-synced by shift roster" : "Tính theo ca trực KTV"}
                    </span>
                  </div>

                  {/* Dropdown for Duration */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      {t.duration}
                    </span>
                    <div className="relative">
                      <select
                        value={slot.duration}
                        onChange={(e) => updateSlot(slot.time, "duration", +e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/30 rounded-xl pl-3 pr-8 py-1.5 text-xs text-on-surface font-bold focus:outline-none focus:border-primary transition-all cursor-pointer appearance-none min-w-[100px]"
                      >
                        {[30, 45, 60, 75, 90, 120].map((d) => (
                          <option key={d} value={d}>
                            {d} {t.minutes}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        keyboard_arrow_down
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Visual representation of Capacity */}
              <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">supervised_user_circle</span>
                    {lang === "en" ? "Scheduled Staff" : "Nhân sự trực ca"}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${scheduledTechCount > 0 ? "bg-green-100 text-green-700" : "bg-error-container text-error"}`}>
                    {scheduledTechCount > 0 ? `${scheduledTechCount} KTV` : "0 KTV"}
                  </span>
                </div>
                <div className="text-[11px] text-on-surface-variant leading-normal">
                  {scheduledTechCount > 0 ? (
                    <span className="text-green-600 font-medium">✓ Sẵn sàng nhận tối đa {scheduledTechCount} lịch đặt song song.</span>
                  ) : (
                    <span className="text-error font-medium">⚠️ Khung giờ này sẽ bị khóa đặt lịch do không có nhân viên trực.</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Tip Footer */}
      <p className="mt-4 text-xs text-on-surface-variant flex items-center gap-1.5 bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/20">
        <span className="material-symbols-outlined text-primary text-[18px]">info</span>
        {t.infoTip}
      </p>
    </div>
  );
}
