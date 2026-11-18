"use client";
import { useCallback, useEffect, useState } from "react";
import { adminService, type Promotion } from "@/lib/services/admin.service";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { ReactNode } from "react";

const money = (value: number | string | null) =>
  value === null || value === undefined ? "-" : Number(value).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function AdminPromotions() {
  const { language } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("100000");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [usageLimitTotal, setUsageLimitTotal] = useState("100");
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountValueError, setDiscountValueError] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");

  const validateDateRange = (start: string, end: string): string => {
    if (!start || !end) return "";
    return new Date(end) <= new Date(start)
      ? t("Ngày kết thúc phải sau ngày bắt đầu.", "End date must be after start date.")
      : "";
  };

  const validateDiscountValue = (value: string, type: string): string => {
    const num = Number(value);
    if (!value || Number.isNaN(num)) return t("Vui lòng nhập mức giảm giá.", "Please enter a discount value.");
    if (num <= 0) return t("Mức giảm phải lớn hơn 0.", "Discount value must be greater than 0.");
    if (type === "percentage" && num > 100)
      return t("Phần trăm giảm không được vượt quá 100%.", "Discount percentage cannot exceed 100%.");
    return "";
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Confirm modal
  type ConfirmCfg = {
    title: string;
    description?: string;
    bullets?: ReactNode[];
    confirmLabel: string;
    variant: "danger" | "warning";
    icon: string;
    action: () => Promise<void>;
  };
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const runConfirm = async () => {
    if (!confirmCfg || isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmCfg.action();
    } finally {
      setIsConfirming(false);
      setConfirmCfg(null);
    }
  };

  const loadPromotions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setPromotions(await adminService.getPromotions());
    } catch {
      setError(t("Chưa thể tải danh sách khuyến mãi. Vui lòng thử lại sau.", "Cannot load promotions list. Please try again later."));
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedPromo(null);
    setName("");
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("10");
    setMinOrderAmount("0");
    setMaxDiscountAmount("100000");
    
    // Set start date as today, end date as next month
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    setStartsAt(today.toISOString().split("T")[0]);
    setEndsAt(nextMonth.toISOString().split("T")[0]);

    setUsageLimitTotal("100");
    setStatus("active");
    setDiscountValueError("");
    setDateRangeError("");
    setModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setModalMode("edit");
    setSelectedPromo(promo);
    setName(promo.name);
    setCode(promo.code);
    setDescription(promo.description || "");
    setDiscountType(promo.discountType || "percentage");
    setDiscountValue(String(promo.discountValue || ""));
    setMinOrderAmount(String(promo.minOrderAmount || "0"));
    setMaxDiscountAmount(String(promo.maxDiscountAmount || ""));
    setStartsAt(new Date(promo.startsAt).toISOString().split("T")[0]);
    setEndsAt(new Date(promo.endsAt).toISOString().split("T")[0]);
    setUsageLimitTotal(String(promo.usageLimitTotal || ""));
    setStatus(promo.status);
    setDiscountValueError("");
    setDateRangeError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !startsAt || !endsAt) {
      alert(t("Vui lòng điền đầy đủ các thông tin bắt buộc (Tên, Mã, Ngày bắt đầu/kết thúc).", "Please fill in all required fields (Name, Code, Start/End dates)."));
      return;
    }
    const dvErr = validateDiscountValue(discountValue, discountType);
    if (dvErr) { setDiscountValueError(dvErr); return; }

    const drErr = validateDateRange(startsAt, endsAt);
    if (drErr) { setDateRangeError(drErr); return; }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue: Number(discountValue) || 0,
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      usageLimitTotal: usageLimitTotal ? Number(usageLimitTotal) : null,
      status,
    };

    try {
      if (modalMode === "create") {
        await adminService.createPromotion(payload);
        showToast(t("✓ Tạo khuyến mãi thành công!", "✓ Promotion created successfully!"));
      } else if (modalMode === "edit" && selectedPromo) {
        await adminService.updatePromotion(selectedPromo.id, payload);
        showToast(t("✓ Cập nhật khuyến mãi thành công!", "✓ Promotion updated successfully!"));
      }
      setModalOpen(false);
      void loadPromotions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast(`✗ ${msg || t("Không lưu được chương trình khuyến mãi.", "Failed to save promotion.")}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const promo = promotions.find((p) => p.id === id);
    if (!promo) return;
    setConfirmCfg({
      title: t("Xóa chương trình khuyến mãi?", "Delete This Promotion?"),
      description: t("Thao tác này không thể hoàn tác:", "This action cannot be undone:"),
      bullets: [
        language === "en"
          ? <span>Promotion <strong>{promo.name}</strong> (code: <code>{promo.code}</code>) will be permanently deleted</span>
          : <span>Chương trình <strong>{promo.name}</strong> (mã: <code>{promo.code}</code>) sẽ bị xóa vĩnh viễn</span>,
        t("Mã giảm giá này sẽ ngừng hoạt động ngay lập tức",
          "This discount code will stop working immediately"),
      ],
      confirmLabel: t("Xóa khuyến mãi", "Delete Promotion"),
      variant: "danger",
      icon: "delete_forever",
      action: async () => {
        try {
          await adminService.deletePromotion(id);
          showToast(t("✓ Xóa khuyến mãi thành công!", "✓ Promotion deleted successfully!"));
          void loadPromotions();
        } catch {
          showToast(t("✗ Không thể xóa khuyến mãi.", "✗ Cannot delete promotion."));
        }
      },
    });
  };

  const activeCount = promotions.filter((item) => item.status === "active").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            {t("Quản lý khuyến mãi", "Promotions Manager")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t("Thiết lập mã giảm giá, chương trình ưu đãi, kiểm soát giới hạn lượt dùng và thời hạn áp dụng.", "Set discount codes, promotional offers, usage limits, and active periods.")}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity font-bold shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t("Thêm khuyến mãi", "Add Promotion")}
          </button>
          <button
            onClick={() => void loadPromotions()}
            className="border border-outline-variant px-4 py-2.5 rounded-full text-sm hover:bg-surface-container font-medium"
          >
            {t("Làm mới", "Refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Tổng chương trình", "Total Promotions")}</p>
          <p className="text-2xl font-bold text-primary mt-1">{promotions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Đang chạy", "Active")}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Lượt đã áp dụng", "Applied Times")}</p>
          <p className="text-2xl font-bold text-primary mt-1">
            {promotions.reduce((sum, item) => sum + (item.usedCount || 0), 0)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Đang tải danh sách khuyến mãi...", "Loading promotions...")}
        </div>
      ) : promotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Chưa có chương trình khuyến mãi nào được tạo.", "No promotions created yet.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((promo) => {
            const isPercent = promo.discountType === "percentage" || promo.discountType === "percent";
            return (
              <article key={promo.id} className="bg-white rounded-2xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-label-md text-sm text-on-surface font-bold truncate">{promo.name}</h3>
                    <code className="inline-block mt-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded">
                      {promo.code}
                    </code>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase shrink-0 whitespace-nowrap ${
                    promo.status === "active" ? "bg-green-50 text-green-700 border border-green-200" : "bg-surface-container text-on-surface-variant"
                  }`}>
                    {promo.status === "active" ? t("Đang chạy", "Active") : t("Tạm dừng", "Paused")}
                  </span>
                </div>
                
                <p className="text-xs text-on-surface-variant line-clamp-2 min-h-8">
                  {promo.description || t("Chưa có mô tả chi tiết.", "No description available.")}
                </p>
                
                <div className="mt-3 text-xl font-bold text-primary">
                  {isPercent ? `${promo.discountValue}%` : money(promo.discountValue)}
                </div>
                
                <div className="mt-3 pt-3 border-t border-outline-variant/10 space-y-1.5 text-[10px] text-on-surface-variant font-medium">
                  <p className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary" style={{ fontSize: 12 }}>calendar_today</span>
                    {formatDate(promo.startsAt)} - {formatDate(promo.endsAt)}
                  </p>
                  <p className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary" style={{ fontSize: 12 }}>how_to_reg</span>
                    {t("Đã sử dụng:", "Used:")} {promo.usedCount ?? 0}{promo.usageLimitTotal ? ` / ${promo.usageLimitTotal}` : ""} {t("lượt", "times")}
                  </p>
                  <p className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary" style={{ fontSize: 12 }}>payments</span>
                    {t("Đơn tối thiểu:", "Min order:")} {money(promo.minOrderAmount)} | {t("Giảm tối đa:", "Max cap:")} {money(promo.maxDiscountAmount)}
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2 mt-3 border-t border-outline-variant/10">
                  <button
                    onClick={() => openEditModal(promo)}
                    className="bg-primary/10 hover:bg-primary hover:text-white text-primary px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                    title={t("Chỉnh sửa", "Edit")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                    {t("Sửa", "Edit")}
                  </button>
                  <button
                    onClick={() => void handleDelete(promo.id)}
                    className="bg-error-container/20 hover:bg-error hover:text-white text-error px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                    title={t("Xóa", "Delete")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                    {t("Xóa", "Delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={!!confirmCfg}
        icon={confirmCfg?.icon ?? "warning"}
        title={confirmCfg?.title ?? ""}
        description={confirmCfg?.description}
        bullets={confirmCfg?.bullets}
        confirmLabel={confirmCfg?.confirmLabel ?? t("Xác nhận", "Confirm")}
        variant={confirmCfg?.variant ?? "danger"}
        isLoading={isConfirming}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirmCfg(null)}
      />

      {/* CRUD Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {modalMode === "create" ? t("Thêm khuyến mãi mới", "Add New Promotion") : t("Chỉnh sửa khuyến mãi", "Edit Promotion")}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Tên khuyến mãi *", "Promotion Name *")}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("VD: Chào Hè Rực Rỡ", "e.g. Summer Special")}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mã code ưu đãi *", "Promo Code *")}</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: HELLO2026"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Loại chiết khấu *", "Discount Type *")}</label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      setDiscountType(e.target.value);
                      setDiscountValueError(validateDiscountValue(discountValue, e.target.value));
                    }}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="percentage">{t("Phần trăm (%)", "Percentage (%)")}</option>
                    <option value="fixed_amount">{t("Số tiền cố định (đ)", "Fixed Amount (VND)")}</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">
                    {t("Mức giảm giá *", "Value *")}
                    {discountType === "percentage" && (
                      <span className="ml-1 text-on-surface-variant/50 normal-case font-normal">(1 – 100%)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={discountType === "percentage" ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => {
                      setDiscountValue(e.target.value);
                      setDiscountValueError(validateDiscountValue(e.target.value, discountType));
                    }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                      discountValueError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
                    }`}
                  />
                  {discountValueError && (
                    <p className="mt-1 text-[11px] text-error font-medium">{discountValueError}</p>
                  )}
                  {!discountValueError && discountType === "percentage" && Number(discountValue) > 0 && (
                    <p className="mt-1 text-[11px] text-on-surface-variant/60">
                      {t(`Giảm ${discountValue}% trên tổng đơn hàng`, `${discountValue}% off total order`)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Đơn tối thiểu (VND) *", "Min Purchase (VND) *")}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Giảm tối đa (VND)", "Max Cap (VND)")}</label>
                  <input
                    type="number"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    placeholder={t("Để trống nếu không giới hạn", "Leave blank for no limit")}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Ngày bắt đầu *", "Start Date *")}</label>
                    <input
                      type="date"
                      required
                      value={startsAt}
                      onChange={(e) => {
                        setStartsAt(e.target.value);
                        setDateRangeError(validateDateRange(e.target.value, endsAt));
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                        dateRangeError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Ngày kết thúc *", "End Date *")}</label>
                    <input
                      type="date"
                      required
                      value={endsAt}
                      onChange={(e) => {
                        setEndsAt(e.target.value);
                        setDateRangeError(validateDateRange(startsAt, e.target.value));
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                        dateRangeError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
                      }`}
                    />
                  </div>
                </div>
                {dateRangeError && (
                  <p className="text-[11px] text-error font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                    {dateRangeError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Giới hạn số lần dùng", "Total Usage Limit")}</label>
                  <input
                    type="number"
                    value={usageLimitTotal}
                    onChange={(e) => setUsageLimitTotal(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Trạng thái hoạt động", "Status")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="active">{t("Kích hoạt", "Active")}</option>
                    <option value="paused">{t("Tạm ngưng", "Paused")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mô tả chương trình", "Promotion Description")}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("VD: Chương trình chào hè áp dụng cho dịch vụ massage...", "e.g. Summer campaign applied on massage treatments...")}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-outline-variant rounded-full py-2.5 text-sm hover:bg-surface-container font-medium"
                >
                  {t("Hủy", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary text-on-primary rounded-full py-2.5 text-sm hover:opacity-90 font-bold disabled:opacity-50"
                >
                  {isSubmitting ? t("Đang lưu...", "Saving...") : t("Lưu chương trình", "Save Promotion")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
