"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVICES } from "@/lib/mock-data";
import { adminService } from "@/lib/services/admin.service";
import type { SpaService } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { ReactNode } from "react";

const money = (value: number | string) =>
  Number(value).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

export default function AdminServices() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const statusLabel: Record<string, string> = {
    active: t("Đang hoạt động", "Active"),
    inactive: t("Tạm dừng", "Paused"),
  };

  const categoryLabel: Record<string, string> = {
    Facial: t("Chăm sóc da mặt", "Facial Care"),
    Package: t("Gói dịch vụ", "Service Packages"),
    Body: t("Chăm sóc cơ thể", "Body Care"),
    Massage: t("Massage trị liệu", "Massage Therapy"),
    Spa: t("Spa tổng hợp", "General Spa"),
  };

  function getStatusLabel(status: string): string {
    return statusLabel[status] ?? status;
  }

  function getCategoryLabel(category?: string | null): string {
    if (!category) return t("Khác", "Other");
    return tService(categoryLabel[category] ?? category);
  }

  const [services, setServices] = useState<SpaService[]>([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedService, setSelectedService] = useState<SpaService | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("Massage");
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState("60");
  const [defaultPrice, setDefaultPrice] = useState("500000");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceError, setPriceError] = useState("");

  // Requirement configuration states
  const [allItems, setAllItems] = useState<any[]>([]);
  const [currentRequirements, setCurrentRequirements] = useState<any[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [reqQty, setReqQty] = useState("");

  const PRICE_MIN = 10_000;
  const PRICE_MAX = 10_000_000;

  const handlePriceChange = (value: string) => {
    setDefaultPrice(value);
    const num = Number(value);
    if (!value) { setPriceError(""); return; }
    if (num < PRICE_MIN) setPriceError(`Giá tối thiểu là ${PRICE_MIN.toLocaleString("vi-VN")}₫`);
    else if (num > PRICE_MAX) setPriceError(`Giá tối đa là ${PRICE_MAX.toLocaleString("vi-VN")}₫`);
    else setPriceError("");
  };

  const loadReqData = useCallback(async (serviceId: string) => {
    setLoadingReqs(true);
    try {
      const [itemsList, reqsList] = await Promise.all([
        adminService.getAllInventoryItems(),
        adminService.getInventoryRequirements(),
      ]);
      setAllItems(itemsList || []);
      setCurrentRequirements((reqsList || []).filter((r: any) => r.serviceId === serviceId));
    } catch (err) {
      console.error("Failed to load requirement data:", err);
    } finally {
      setLoadingReqs(false);
    }
  }, []);

  useEffect(() => {
    if (modalOpen && modalMode === "edit" && selectedService) {
      loadReqData(selectedService.id);
      setSelectedItemId("");
      setReqQty("");
    }
  }, [modalOpen, modalMode, selectedService, loadReqData]);

  const handleAddRequirement = async () => {
    if (!selectedService || !selectedItemId || !reqQty || isNaN(parseFloat(reqQty)) || parseFloat(reqQty) <= 0) {
      alert("Vui lòng chọn vật tư và nhập số lượng lớn hơn 0.");
      return;
    }
    try {
      await adminService.createServiceRequirement({
        serviceId: selectedService.id,
        inventoryItemId: selectedItemId,
        quantityPerService: parseFloat(reqQty),
      });
      showToast("✓ Thêm định lượng vật tư thành công!");
      setSelectedItemId("");
      setReqQty("");
      void loadReqData(selectedService.id);
    } catch (err) {
      alert("Không thể thêm định lượng vật tư.");
    }
  };

  const handleDeleteRequirement = async (reqId: string) => {
    if (!selectedService) return;
    if (!confirm("Bạn có chắc chắn muốn xóa định lượng vật tư này?")) return;
    try {
      await adminService.deleteServiceRequirement(reqId);
      showToast("✓ Đã xóa định lượng vật tư.");
      void loadReqData(selectedService.id);
    } catch (err) {
      alert("Không thể xóa định lượng vật tư.");
    }
  };

  const categories = useMemo(() => {
    const set = new Set(services.map((s) => s.category).filter((c): c is string => typeof c === "string" && c.length > 0));
    return Array.from(set);
  }, [services]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setServices(await adminService.getServices());
    } catch {
      setError(t("Chưa thể tải danh mục dịch vụ. Vui lòng thử lại sau.", "Cannot load services directory. Please try again later."));
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const toggleStatus = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;

    if (svc.status === "active") {
      if (services.filter((s) => s.status === "active").length <= 1) {
        showToast(t("Phải có ít nhất 1 dịch vụ đang hoạt động.", "At least 1 service must remain active."));
        return;
      }
      setConfirmCfg({
        title: t("Tạm ngưng dịch vụ?", "Pause This Service?"),
        description: t("Dịch vụ sẽ tạm thời không được cung cấp:", "This service will temporarily be unavailable:"),
        bullets: [
          language === "en"
            ? <span>Service <strong>{tService(svc.name)}</strong> will switch to Paused</span>
            : <span>Dịch vụ <strong>{tService(svc.name)}</strong> chuyển sang Tạm ngưng</span>,
          t("Khách hàng không thể đặt lịch cho dịch vụ này",
            "Customers cannot book this service"),
          t("Có thể kích hoạt lại bất cứ lúc nào",
            "Can be reactivated at any time"),
        ],
        confirmLabel: t("Xác nhận tạm ngưng", "Confirm Pause"),
        variant: "warning",
        icon: "pause_circle",
        action: async () => {
          try {
            await adminService.updateService(id, { status: "inactive" });
            showToast(t("✓ Dịch vụ đã được tạm ngưng.", "✓ Service deactivated."));
            void loadServices();
          } catch {
            showToast(t("✗ Không thể cập nhật trạng thái dịch vụ.", "✗ Failed to update service status."));
          }
        },
      });
    } else {
      setTogglingId(id);
      void (async () => {
        try {
          await adminService.updateService(id, { status: "active" });
          showToast(t("✓ Dịch vụ đã được kích hoạt.", "✓ Service activated."));
          void loadServices();
        } catch {
          showToast(t("✗ Không thể cập nhật trạng thái dịch vụ.", "✗ Failed to update service status."));
        } finally {
          setTogglingId(null);
        }
      })();
    }
  };


  const filtered = filter === "all" ? services : services.filter((s) => s.category === filter || s.status === filter);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedService(null);
    setName("");
    setCode("");
    setSlug("");
    setCategory("Massage");
    setDefaultDurationMinutes("60");
    setDefaultPrice("500000");
    setDescription("");
    setStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (svc: SpaService) => {
    setModalMode("edit");
    setSelectedService(svc);
    setName(svc.name);
    setCode(svc.code);
    setSlug(svc.slug);
    setCategory(svc.category || "Massage");
    setDefaultDurationMinutes(String(svc.defaultDurationMinutes || "60"));
    setDefaultPrice(String(svc.defaultPrice || "500000"));
    setDescription(svc.description || "");
    setStatus(svc.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !slug.trim()) {
      alert(t("Vui lòng nhập các thông tin bắt buộc (Tên, Mã, Slug).", "Please enter all required fields (Name, Code, Slug)."));
      return;
    }
    const priceNum = Number(defaultPrice);
    if (priceNum < PRICE_MIN || priceNum > PRICE_MAX) {
      setPriceError(`Giá phải từ ${PRICE_MIN.toLocaleString("vi-VN")}₫ đến ${PRICE_MAX.toLocaleString("vi-VN")}₫`);
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      slug: slug.trim().toLowerCase(),
      category: category.trim(),
      defaultDurationMinutes: Number(defaultDurationMinutes) || 60,
      defaultPrice: Number(defaultPrice) || 0,
      description: description.trim() || undefined,
      status,
    };

    try {
      if (modalMode === "create") {
        await adminService.createService(payload);
        showToast(t("✓ Tạo dịch vụ thành công!", "✓ Service created successfully!"));
      } else if (modalMode === "edit" && selectedService) {
        await adminService.updateService(selectedService.id, payload);
        showToast(t("✓ Cập nhật dịch vụ thành công!", "✓ Service updated successfully!"));
      }
      setModalOpen(false);
      void loadServices();
    } catch (err) {
      alert(t("Không lưu được dịch vụ.", "Failed to save service."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setConfirmCfg({
      title: t("Xóa dịch vụ này?", "Delete This Service?"),
      description: t("Thao tác này không thể hoàn tác:", "This action cannot be undone:"),
      bullets: [
        language === "en"
          ? <span>Service <strong>{tService(svc.name)}</strong> will be permanently deleted</span>
          : <span>Dịch vụ <strong>{tService(svc.name)}</strong> sẽ bị xóa vĩnh viễn</span>,
        t("Lịch sử đặt lịch liên quan vẫn được giữ lại trong hệ thống",
          "Related booking history will be retained in the system"),
      ],
      confirmLabel: t("Xóa dịch vụ", "Delete Service"),
      variant: "danger",
      icon: "delete_forever",
      action: async () => {
        try {
          await adminService.deleteService(id);
          showToast(t("✓ Xóa dịch vụ thành công!", "✓ Service deleted successfully!"));
          void loadServices();
        } catch {
          showToast(t("✗ Không thể xóa dịch vụ.", "✗ Cannot delete service."));
        }
      },
    });
  };

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
            {t("Danh mục dịch vụ", "Spa Services Directory")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t("Quản lý danh sách dịch vụ spa, thời lượng điều trị, giá bán niêm yết và phân loại dịch vụ.", "Manage spa services catalog, treatment durations, retail list prices, and classifications.")}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity font-bold shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t("Thêm dịch vụ", "Add Service")}
          </button>
          <button
            onClick={() => void loadServices()}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Tổng dịch vụ", "Total Services")}</p>
          <p className="text-2xl font-bold text-primary mt-1">{services.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Đang hoạt động", "Active")}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{services.filter((s) => s.status === "active").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Tạm dừng", "Paused")}</p>
          <p className="text-2xl font-bold text-on-surface-variant mt-1">{services.filter((s) => s.status !== "active").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Danh mục", "Categories")}</p>
          <p className="text-2xl font-bold text-primary mt-1">{categories.length}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "active", "inactive", ...categories].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === item
                ? "bg-primary text-on-primary shadow-sm"
                : "border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
            }`}
          >
            {item === "all" ? t("Tất cả", "All") : item === "active" || item === "inactive" ? getStatusLabel(item) : getCategoryLabel(item)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Đang tải danh mục dịch vụ...", "Loading services catalog...")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Không có dịch vụ nào khớp với bộ lọc đã chọn.", "No services match the selected filter.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((service) => (
            <article key={service.id} className="bg-white rounded-2xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-label-md text-sm text-on-surface font-bold truncate pr-16">{tService(service.name)}</h3>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 uppercase font-bold">{service.code} · {service.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                  service.status === "active" ? "bg-green-50 text-green-700 border border-green-200" : "bg-surface-container text-on-surface-variant"
                }`}>
                  {getStatusLabel(service.status)}
                </span>
              </div>
              
              <p className="text-xs text-on-surface-variant line-clamp-2 min-h-8 mb-4">
                {tService(service.description) || t("Chưa cấu hình mô tả chi tiết cho dịch vụ này.", "Detailed description has not been configured for this service yet.")}
              </p>
              
              <div className="flex items-center gap-4 text-xs pt-3 border-t border-outline-variant/10 text-on-surface-variant">
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-sm text-primary">category</span>{getCategoryLabel(service.category)}</span>
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-sm text-primary">schedule</span>{service.defaultDurationMinutes} {t("phút", "mins")}</span>
                <span className="font-bold text-primary ml-auto">{money(service.defaultPrice)}</span>
              </div>

              <div className="flex gap-2 justify-end pt-2 mt-2 border-t border-outline-variant/10">
                <button
                  onClick={() => void toggleStatus(service.id)}
                  disabled={togglingId === service.id}
                  className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold disabled:opacity-50 ${
                    service.status === "active"
                      ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                  }`}
                  title={service.status === "active" ? t("Tạm ngưng", "Deactivate") : t("Kích hoạt", "Activate")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {service.status === "active" ? "pause" : "play_arrow"}
                  </span>
                  {service.status === "active" ? t("Tạm ngưng", "Pause") : t("Kích hoạt", "Activate")}
                </button>
                <button
                  onClick={() => openEditModal(service)}
                  className="bg-primary/10 hover:bg-primary hover:text-white text-primary px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                  title={t("Chỉnh sửa", "Edit")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                  {t("Sửa", "Edit")}
                </button>
                <button
                  onClick={() => void handleDelete(service.id)}
                  className="bg-error-container/20 hover:bg-error hover:text-white text-error px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                  title={t("Xóa", "Delete")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                  {t("Xóa", "Delete")}
                </button>
              </div>
            </article>
          ))}
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-2rem)] p-6 shadow-xl flex flex-col">
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3 shrink-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {modalMode === "create" ? t("Thêm dịch vụ mới", "Add New Service") : t("Chỉnh sửa dịch vụ", "Edit Service")}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Tên dịch vụ *", "Service Name *")}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("VD: Massage Trị Liệu Đá Muối", "e.g. Salt Stone Therapy")}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">
                    {t("Mã dịch vụ *", "Service Code *")}
                    {modalMode === "edit" && (
                      <span className="ml-1 normal-case font-normal text-on-surface-variant/60">
                        <span className="material-symbols-outlined align-middle" style={{ fontSize: 12 }}>lock</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    readOnly={modalMode === "edit"}
                    onChange={(e) => modalMode === "create" && setCode(e.target.value)}
                    placeholder="VD: MS-SALT"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                      modalMode === "edit"
                        ? "border-outline-variant/40 bg-surface-container text-on-surface-variant cursor-not-allowed select-none"
                        : "border-outline-variant focus:border-primary"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Slug (Đường dẫn thân thiện) *", "Slug (Url path) *")}</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="VD: massage-da-muoi"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Danh mục *", "Category *")}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="Massage">{t("Massage trị liệu", "Massage Therapy")}</option>
                    <option value="Facial">{t("Chăm sóc da mặt", "Facial Care")}</option>
                    <option value="Body">{t("Chăm sóc cơ thể", "Body Care")}</option>
                    <option value="Package">{t("Gói dịch vụ", "Service Packages")}</option>
                    <option value="Spa">{t("Spa tổng hợp", "General Spa")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Thời lượng (phút) *", "Duration (mins) *")}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={defaultDurationMinutes}
                    onChange={(e) => setDefaultDurationMinutes(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Giá niêm yết (VND) *", "Listed Price (VND) *")}</label>
                  <input
                    type="number"
                    required
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    value={defaultPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                      priceError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
                    }`}
                  />
                  {priceError && (
                    <p className="mt-1 text-[11px] text-error">{priceError}</p>
                  )}
                  {!priceError && (
                    <p className="mt-1 text-[11px] text-on-surface-variant/60">
                      {t("10.000₫ – 10.000.000₫", "10,000₫ – 10,000,000₫")}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Trạng thái", "Status")}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                >
                  <option value="active">{t("Hoạt động", "Active")}</option>
                  <option value="inactive">{t("Tạm ngưng", "Paused")}</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mô tả dịch vụ", "Service Description")}</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("Nhập mô tả chi tiết liệu trình...", "Enter detailed treatment procedure description...")}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {modalMode === "edit" && selectedService && (
                <div className="border-t border-outline-variant/20 pt-4 space-y-3">
                  <h3 className="font-bold text-on-surface uppercase text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                    Vật tư tiêu hao (Định lượng trị liệu)
                  </h3>
                  
                  {loadingReqs ? (
                    <div className="text-center py-4 text-on-surface-variant italic">Đang tải dữ liệu định lượng...</div>
                  ) : (
                    <div className="space-y-3 bg-stone-50 p-3.5 rounded-xl border border-outline-variant/20">
                      {/* List current requirements */}
                      {currentRequirements.length === 0 ? (
                        <p className="text-on-surface-variant italic text-[11px] text-center">Chưa cấu hình định lượng vật tư cho dịch vụ này.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {currentRequirements.map((req) => (
                            <div key={req.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-outline-variant/10">
                              <span className="font-medium text-stone-800">{req.inventoryItem?.name || "Vật tư không tên"} ({req.inventoryItem?.unit})</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{req.quantityPerService}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRequirement(req.id)}
                                  className="text-error hover:bg-error-container/20 p-1 rounded-md transition-colors"
                                  title="Xóa vật tư này"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new requirement form */}
                      <div className="border-t border-outline-variant/10 pt-3 flex items-end gap-2 text-xs">
                        <div className="flex-1">
                          <label className="block mb-1 text-on-surface-variant/60 font-bold uppercase text-[9px]">Chọn vật tư</label>
                          <select
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full border border-outline-variant rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                          >
                            <option value="">-- Chọn vật tư --</option>
                            {allItems
                              .filter((item) => !currentRequirements.some((r) => r.inventoryItemId === item.id))
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block mb-1 text-on-surface-variant/60 font-bold uppercase text-[9px]">Số lượng</label>
                          <input
                            type="number"
                            min={0.001}
                            step={0.001}
                            placeholder="Số lượng..."
                            value={reqQty}
                            onChange={(e) => setReqQty(e.target.value)}
                            className="w-full border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddRequirement}
                          className="bg-primary text-on-primary px-3 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-0.5 animate-none"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>Thêm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  {isSubmitting ? t("Đang lưu...", "Saving...") : t("Lưu dịch vụ", "Save Service")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
