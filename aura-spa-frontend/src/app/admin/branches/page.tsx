"use client";
import { useCallback, useEffect, useState } from "react";
import { adminService } from "@/lib/services/admin.service";
import type { Branch } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { ReactNode } from "react";

function formatCoordinate(value: number | string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : String(value);
}

export default function AdminBranches() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // branchId → tên manager phụ trách
  const [branchManagerMap, setBranchManagerMap] = useState<Record<string, string>>({});

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

  // Branch Detail Activity States
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailBranch, setDetailBranch] = useState<Branch | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPeriod, setDetailPeriod] = useState<"week" | "month" | "year">("month");
  const [detailIsMock, setDetailIsMock] = useState(false);

  const loadBranchDetail = useCallback(async (branchId: string, periodType: "week" | "month" | "year") => {
    setDetailLoading(true);
    setDetailIsMock(false);
    try {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      if (periodType === "week") {
        from.setTime(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (periodType === "year") {
        from.setFullYear(to.getFullYear() - 1);
      } else {
        from.setTime(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      from.setHours(0, 0, 0, 0);

      const res = await adminService.getBranchPerformance(branchId, from.toISOString(), to.toISOString());
      setDetailData(res);
    } catch (err) {
      console.error("Lỗi lấy chi tiết chi nhánh:", err);
      setDetailIsMock(true);
      setDetailData({
        branchId,
        periodFrom: new Date().toISOString(),
        periodTo: new Date().toISOString(),
        revenue: {
          totalRevenue: 385000000,
          totalBookings: 124,
          completedBookings: 112,
          cancelledBookings: 8,
          averageBookingValue: 3437500,
        },
        staffPerformance: [
          { technicianId: "t1", technicianName: "Nguyễn Thị Lan", completedServices: 38, averageRating: 4.9, reviewCount: 16 },
          { technicianId: "t2", technicianName: "Lê Văn Hùng", completedServices: 34, averageRating: 4.6, reviewCount: 12 },
          { technicianId: "t3", technicianName: "Trần Minh Tâm", completedServices: 28, averageRating: 4.8, reviewCount: 10 },
          { technicianId: "t4", technicianName: "Phạm Hồng Nhung", completedServices: 12, averageRating: 4.2, reviewCount: 4 },
        ]
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (detailModalOpen && detailBranch) {
      void loadBranchDetail(detailBranch.id, detailPeriod);
    }
  }, [detailModalOpen, detailBranch, detailPeriod, loadBranchDetail]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const list = await adminService.getBranches();
      setBranches(list);
      // Fetch manager cho từng branch song song, không block UI nếu lỗi
      const entries = await Promise.all(
        list.map(async (b) => {
          try {
            const mgrs = await adminService.getBranchManagers(b.id);
            const active = mgrs.find((m: any) => m.status === "active");
            return [b.id, active?.user?.fullName ?? ""] as [string, string];
          } catch {
            return [b.id, ""] as [string, string];
          }
        })
      );
      setBranchManagerMap(Object.fromEntries(entries.filter(([, name]) => name)));
    } catch {
      setError(t("Chưa thể tải danh sách chi nhánh. Vui lòng thử lại sau.", "Unable to load branch list. Please try again later."));
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const handleToggleStatus = (id: string) => {
    const branch = branches.find((b) => b.id === id);
    if (!branch) return;

    if (branch.status === "active") {
      setConfirmCfg({
        title: t("Tạm ngưng chi nhánh?", "Deactivate Branch?"),
        description: t("Hành động này sẽ ảnh hưởng đến:", "This action will affect:"),
        bullets: [
          language === "en"
            ? <span>Branch <strong>{tService(branch.name)}</strong> will switch to Inactive</span>
            : <span>Chi nhánh <strong>{tService(branch.name)}</strong> chuyển sang Tạm ngưng</span>,
          t("Khách hàng không thể đặt lịch tại đây cho đến khi được kích hoạt lại",
            "Customers cannot book here until reactivated"),
          t("Nhân sự tại chi nhánh vẫn không bị ảnh hưởng",
            "Branch staff will not be affected"),
        ],
        confirmLabel: t("Xác nhận tạm ngưng", "Confirm Deactivation"),
        variant: "warning",
        icon: "pause_circle",
        action: async () => {
          try {
            await adminService.updateBranch(id, { status: "inactive" });
            showToast(t("✓ Chi nhánh đã được tạm ngưng.", "✓ Branch has been deactivated."));
            void loadBranches();
          } catch {
            showToast(t("✗ Không thể cập nhật trạng thái chi nhánh.", "✗ Failed to update branch status."));
          }
        },
      });
    } else {
      void (async () => {
        try {
          await adminService.updateBranch(id, { status: "active" });
          showToast(t("✓ Chi nhánh đã được mở lại.", "✓ Branch is now active."));
          void loadBranches();
        } catch {
          showToast(t("✗ Không thể cập nhật trạng thái chi nhánh.", "✗ Failed to update branch status."));
        }
      })();
    }
  };


  const openCreateModal = () => {
    setModalMode("create");
    setSelectedBranch(null);
    setName("");
    setCode("");
    setAddress("");
    setCity(t("Hồ Chí Minh", "Ho Chi Minh"));
    setDistrict("");
    setPhone("");
    setLatitude("");
    setLongitude("");
    setStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setModalMode("edit");
    setSelectedBranch(branch);
    setName(branch.name);
    setCode(branch.code);
    setAddress(branch.address);
    setCity(branch.city);
    setDistrict(branch.district || "");
    setPhone(branch.phone || "");
    setLatitude(String(branch.latitude || ""));
    setLongitude(String(branch.longitude || ""));
    setStatus(branch.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !address.trim() || !city.trim()) {
      alert(t("Vui lòng điền đầy đủ thông tin bắt buộc (Tên, Mã, Địa chỉ, Thành phố).", "Please fill in all required fields (Name, Code, Address, City)."));
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address.trim(),
      city: city.trim(),
      district: district.trim() || undefined,
      phone: phone.trim() || undefined,
      latitude: latitude ? Number(latitude) : 0,
      longitude: longitude ? Number(longitude) : 0,
      status,
    };

    try {
      if (modalMode === "create") {
        await adminService.createBranch(payload);
        showToast(t("✓ Tạo chi nhánh thành công!", "✓ Branch created successfully!"));
      } else if (modalMode === "edit" && selectedBranch) {
        await adminService.updateBranch(selectedBranch.id, payload);
        showToast(t("✓ Cập nhật chi nhánh thành công!", "✓ Branch updated successfully!"));
      }
      setModalOpen(false);
      void loadBranches();
    } catch (err) {
      alert(t("Không lưu được thông tin chi nhánh.", "Failed to save branch information."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const branch = branches.find((b) => b.id === id);
    if (!branch) return;
    setConfirmCfg({
      title: t("Xóa chi nhánh này?", "Delete This Branch?"),
      description: t("Thao tác này không thể hoàn tác:", "This action cannot be undone:"),
      bullets: [
        language === "en"
          ? <span>Branch <strong>{tService(branch.name)}</strong> will be permanently deleted</span>
          : <span>Chi nhánh <strong>{tService(branch.name)}</strong> sẽ bị xóa vĩnh viễn</span>,
        t("Nhân sự và lịch sử hoạt động sẽ mất liên kết với chi nhánh này",
          "Staff and activity history will be unlinked from this branch"),
      ],
      confirmLabel: t("Xóa vĩnh viễn", "Delete Permanently"),
      variant: "danger",
      icon: "delete_forever",
      action: async () => {
        try {
          await adminService.deleteBranch(id);
          showToast(t("✓ Xóa chi nhánh thành công!", "✓ Branch deleted successfully!"));
          void loadBranches();
        } catch {
          showToast(t("✗ Không thể xóa chi nhánh.", "✗ Unable to delete branch."));
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
            {t("Hệ thống chi nhánh", "Branch System")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t(
              "Quản lý, theo dõi trạng thái vận hành, thông tin liên hệ và vị trí của từng chi nhánh trên bản đồ.",
              "Manage, monitor operational status, contact information and map locations for each branch."
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity font-bold shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t("Thêm chi nhánh", "Add Branch")}
          </button>
          <button
            onClick={() => void loadBranches()}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Tổng chi nhánh", "Total Branches")}</p>
          <p className="text-2xl font-bold text-primary mt-1">{branches.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Đang hoạt động", "Active")}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{branches.filter((b) => b.status === "active").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/20 p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase font-bold">{t("Thành phố phủ sóng", "Cities Covered")}</p>
          <p className="text-2xl font-bold text-primary mt-1">{new Set(branches.map((b) => b.city)).size}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Đang tải danh sách chi nhánh...", "Loading branch list...")}
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Chưa có chi nhánh nào được cấu hình trong hệ thống.", "No branches configured in the system.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((branch) => (
            <article key={branch.id} className="bg-white rounded-2xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
              {/* Header: tên + badge trạng thái */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-primary leading-snug" title={tService(branch.name)}>
                    {tService(branch.name)}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase mt-0.5 tracking-wide">{branch.code}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  branch.status === "active"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-surface-container text-on-surface-variant border border-outline-variant/40"
                }`}>
                  {branch.status === "active" ? t("Hoạt động", "Active") : t("Tạm ngưng", "Inactive")}
                </span>
              </div>

              {/* Thông tin liên hệ */}
              <div className="space-y-1.5 text-xs text-on-surface-variant border-t border-outline-variant/10 pt-3">
                <p className="flex gap-2 items-start">
                  <span className="material-symbols-outlined text-primary shrink-0 mt-px" style={{ fontSize: 14 }}>location_on</span>
                  <span className="line-clamp-2">{tService(branch.address)}</span>
                </p>
                <p className="flex gap-2 items-center">
                  <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>map</span>
                  <span>{branch.district ? `${branch.district}, ` : ""}{tService(branch.city)}</span>
                </p>
                <p className="flex gap-2 items-center">
                  <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>phone</span>
                  <span>{branch.phone || <span className="italic opacity-50">{t("Chưa cấu hình", "Not set")}</span>}</span>
                </p>
                {(branch.latitude || branch.longitude) && (
                  <p className="flex gap-2 items-center">
                    <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>near_me</span>
                    <span className="font-mono text-[11px]">{formatCoordinate(branch.latitude)}, {formatCoordinate(branch.longitude)}</span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t border-outline-variant/10 mt-auto">
                <button
                  onClick={() => { setDetailBranch(branch); setDetailModalOpen(true); }}
                  className="bg-primary/12 hover:bg-primary text-primary hover:text-white border border-primary/15 hover:border-primary px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>monitoring</span>
                  {t("Xem hoạt động", "View Activity")}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleToggleStatus(branch.id)}
                    className={`border p-2 rounded-full transition-all shadow-sm hover:shadow-md ${
                      branch.status === "active"
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                    title={branch.status === "active" ? t("Tạm ngưng chi nhánh", "Deactivate branch") : t("Kích hoạt chi nhánh", "Activate branch")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {branch.status === "active" ? "pause" : "play_arrow"}
                    </span>
                  </button>
                  <button
                    onClick={() => openEditModal(branch)}
                    className="border border-primary/15 bg-surface-container-low text-primary p-2 rounded-full transition-all shadow-sm hover:bg-primary hover:text-white hover:border-primary hover:shadow-md"
                    title={t("Chỉnh sửa", "Edit")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  </button>
                  <button
                    onClick={() => void handleDelete(branch.id)}
                    className="border border-error/15 bg-error-container/30 text-error p-2 rounded-full transition-all shadow-sm hover:bg-error hover:text-white hover:border-error hover:shadow-md"
                    title={t("Xóa", "Delete")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* CRUD Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {modalMode === "create" ? t("Thêm chi nhánh mới", "Add New Branch") : t("Chỉnh sửa chi nhánh", "Edit Branch")}
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
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Tên chi nhánh *", "Branch Name *")}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: AuraSpa Thủ Đức"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mã chi nhánh *", "Branch Code *")}</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: HCM-TD"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Địa chỉ chi tiết *", "Detailed Address *")}</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Số 12 Đường Võ Văn Ngân"
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Thành phố *", "City *")}</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="VD: Hồ Chí Minh"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Quận / Huyện", "District")}</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="VD: Thủ Đức"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Số điện thoại", "Phone Number")}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0281234567"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Trạng thái", "Status")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="active">{t("Hoạt động", "Active")}</option>
                    <option value="inactive">{t("Tạm ngưng", "Inactive")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Vĩ độ (Latitude)", "Latitude")}</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="VD: 10.8465"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Kinh độ (Longitude)", "Longitude")}</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="VD: 106.7724"
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
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
                  {isSubmitting ? t("Đang xử lý...", "Processing...") : t("Lưu chi nhánh", "Save Branch")}
                </button>
              </div>
            </form>
          </div>
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

      {/* Branch Detail Activity Modal */}
      {detailModalOpen && detailBranch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-outline-variant/10 pb-4">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  {t("Chi tiết hoạt động chi nhánh", "Branch Activity Details")}
                </h2>
                <p className="text-sm text-on-surface font-bold mt-1 text-stone-700">
                  {tService(detailBranch.name)} ({detailBranch.code})
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {tService(detailBranch.address)}, {tService(detailBranch.city)}
                </p>
                {branchManagerMap[detailBranch.id] ? (
                  <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>manage_accounts</span>
                    {t("Quản lý:", "Manager:")}
                    <span className="font-bold text-on-surface">{branchManagerMap[detailBranch.id]}</span>
                  </p>
                ) : (
                  <p className="text-xs mt-1 flex items-center gap-1 text-amber-600">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                    {t("Chưa có quản lý phụ trách chi nhánh này", "No manager assigned to this branch")}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  setDetailData(null);
                  setDetailIsMock(false);
                }}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Period filter */}
            <div className="flex justify-between items-center gap-4 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/10">
              <span className="text-xs font-bold text-on-surface-variant uppercase pl-2">
                {t("Thời kỳ báo cáo", "Reporting Period")}
              </span>
              <div className="flex bg-surface-container rounded-full p-1 border border-outline-variant/10">
                {(["week", "month", "year"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setDetailPeriod(item)}
                    className={`px-3 py-1 rounded-full font-label-sm text-xs transition-all cursor-pointer ${
                      detailPeriod === item ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    {item === "week" ? t("Tuần", "Week") : item === "month" ? t("Tháng", "Month") : t("Năm", "Year")}
                  </button>
                ))}
              </div>
            </div>

            {/* Mock data warning */}
            {detailIsMock && !detailLoading && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2 text-xs text-amber-800">
                <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 16 }}>science</span>
                <span><span className="font-bold">Dữ liệu minh họa</span> — Không thể tải số liệu thực từ backend. Các con số bên dưới là mẫu.</span>
              </div>
            )}

            {/* Content loading state */}
            {detailLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-on-surface-variant font-medium">
                  {t("Đang tải dữ liệu hoạt động...", "Loading activity data...")}
                </p>
              </div>
            ) : !detailData ? (
              <div className="py-20 text-center text-on-surface-variant text-xs">
                {t("Không tìm thấy dữ liệu hoạt động.", "No activity data found.")}
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Overview grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-stone-50 border border-stone-200/60 p-3 rounded-xl">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{t("Doanh thu", "Revenue")}</p>
                    <p className="text-base font-bold text-primary mt-1">
                      {Number(detailData.revenue.totalRevenue).toLocaleString("vi-VN", { style: "currency", currency: "VND" })}
                    </p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200/60 p-3 rounded-xl">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{t("Tổng lịch hẹn", "Total Bookings")}</p>
                    <p className="text-base font-bold text-stone-800 mt-1">
                      {detailData.revenue.totalBookings} {t("đơn", "bookings")}
                    </p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200/60 p-3 rounded-xl col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{t("Giá trị TB/Đơn", "Avg Booking Value")}</p>
                    <p className="text-base font-bold text-secondary mt-1">
                      {Number(detailData.revenue.averageBookingValue ?? 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" })}
                    </p>
                  </div>
                  <div className="bg-green-50/50 border border-green-200/60 p-3 rounded-xl">
                    <p className="text-[10px] text-green-700 uppercase font-bold tracking-wider">{t("Hoàn thành", "Completed")}</p>
                    <p className="text-base font-bold text-green-700 mt-1">
                      {detailData.revenue.completedBookings} {t("lịch", "bookings")}
                    </p>
                  </div>
                  <div className="bg-red-50/50 border border-red-200/60 p-3 rounded-xl">
                    <p className="text-[10px] text-error uppercase font-bold tracking-wider">{t("Đã hủy lịch", "Cancelled")}</p>
                    <p className="text-base font-bold text-error mt-1">
                      {detailData.revenue.cancelledBookings} {t("lịch", "bookings")}
                    </p>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-xl col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">{t("Tỷ lệ hoàn thành", "Completion Rate")}</p>
                    <p className="text-base font-bold text-amber-800 mt-1">
                      {detailData.revenue.totalBookings > 0
                        ? `${Math.round((detailData.revenue.completedBookings / detailData.revenue.totalBookings) * 100)}%`
                        : "0%"}
                    </p>
                  </div>
                </div>

                {/* Staff / Technician Performance Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    {t("Hiệu suất nhân sự tại chi nhánh", "Staff Performance at Branch")}
                  </h4>
                  <div className="border border-outline-variant/20 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-stone-50 border-b border-outline-variant/10">
                        <tr>
                          <th className="px-4 py-2 font-bold text-on-surface-variant uppercase">{t("Nhân viên", "Technician")}</th>
                          <th className="px-4 py-2 font-bold text-on-surface-variant uppercase text-center">{t("Lịch hoàn thành", "Completed")}</th>
                          <th className="px-4 py-2 font-bold text-on-surface-variant uppercase text-center">{t("Đánh giá trung bình", "Avg Rating")}</th>
                          <th className="px-4 py-2 font-bold text-on-surface-variant uppercase text-center">{t("Số lượt đánh giá", "Reviews Count")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-stone-700">
                        {detailData.staffPerformance && detailData.staffPerformance.length > 0 ? (
                          detailData.staffPerformance.map((staff: any) => (
                            <tr key={staff.technicianId} className="hover:bg-stone-50/50">
                              <td className="px-4 py-2.5 font-bold text-stone-900">{staff.technicianName}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-primary">{staff.completedServices}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-amber-600">
                                <span className="flex items-center justify-center gap-1">
                                  {staff.averageRating ?? "-"}
                                  {staff.averageRating && (
                                    <span className="material-symbols-outlined text-xs text-amber-500 fill-current" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>star</span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center text-stone-500">{staff.reviewCount} {t("lượt", "reviews")}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                              {t("Chưa có số liệu nhân viên tại chi nhánh này.", "No staff data available for this branch.")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  setDetailData(null);
                  setDetailIsMock(false);
                }}
                className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-full text-xs font-bold shadow-sm transition-opacity cursor-pointer"
              >
                {t("Đóng", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
