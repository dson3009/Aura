"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { adminService } from "@/lib/services/admin.service";
import type { Branch } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

interface StaffMember {
  id: string;
  userId: string;
  staffCode: string | null;
  position: string;
  status: string;
  startDate: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: string;
    status: string;
  };
  branchId: string;
  branchName?: string;
}

type StaffForm = {
  fullName: string; email: string; phone: string;
  gender: string; position: string; branchId: string; startDate: string;
};
const emptyForm: StaffForm = {
  fullName: "", email: "", phone: "", gender: "unknown",
  position: "technician", branchId: "", startDate: "",
};

export default function AdminStaffOverview() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [toast, setToast] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<StaffForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadBranches = useCallback(async () => {
    try {
      const list = await adminService.getBranches();
      setBranches(list || []);
      return list || [];
    } catch {
      setError(t("Chưa thể tải danh sách chi nhánh.", "Unable to load branch list."));
      return [];
    }
  }, [language]);

  const loadStaff = useCallback(async (branchList?: Branch[]) => {
    setIsLoading(true);
    setError("");
    try {
      const list = branchList ?? branches;
      let merged: StaffMember[] = [];

      if (selectedBranchId === "all") {
        const src = list.length > 0 ? list : await adminService.getBranches();
        const results = await Promise.all(
          src.map(async (b) => {
            try {
              const staff = await adminService.getBranchStaff(b.id);
              return staff.map((s: any) => ({ ...s, branchId: b.id, branchName: b.name }));
            } catch { return []; }
          })
        );
        merged = results.flat();
      } else {
        const staff = await adminService.getBranchStaff(selectedBranchId);
        const br = list.find((b) => b.id === selectedBranchId);
        merged = staff.map((s: any) => ({
          ...s, branchId: selectedBranchId,
          branchName: br ? br.name : t("Chi nhánh hiện tại", "Current branch"),
        }));
      }
      setStaffList(merged);
    } catch {
      setError(t("Không thể tải danh sách nhân viên.", "Unable to load staff list."));
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, branches, language]);

  useEffect(() => {
    loadBranches().then((list) => loadStaff(list));
  }, [language]);

  useEffect(() => {
    if (branches.length > 0) void loadStaff();
  }, [selectedBranchId]);

  const filteredStaff = staffList.filter((s) => {
    const nameMatch =
      s.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.staffCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.user.phone?.includes(searchTerm);
    const roleMatch = roleFilter === "all" || s.position.toLowerCase() === roleFilter;
    return nameMatch && roleMatch;
  });

  const validate = () => {
    const e: Partial<StaffForm> = {};
    if (!form.fullName.trim()) e.fullName = t("Vui lòng nhập họ tên.", "Please enter full name.");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = t("Email không hợp lệ.", "Invalid email.");
    if (!form.branchId) e.branchId = t("Vui lòng chọn chi nhánh.", "Please select a branch.");
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        gender: form.gender,
        position: form.position,
        startDate: form.startDate || undefined,
      };
      if (editTarget) {
        await adminService.updateStaff(editTarget.branchId, editTarget.userId, payload);
        showToast(t("✓ Đã cập nhật nhân viên", "✓ Staff updated"));
      } else {
        await adminService.createStaff(form.branchId, payload);
        showToast(t("✓ Đã tạo tài khoản — mật khẩu mặc định đã gửi qua email", "✓ Account created — default password sent via email"));
      }
      setShowModal(false);
      setEditTarget(null);
      setForm(emptyForm);
      setFormErrors({});
      void loadStaff();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast(`✗ ${msg || t("Không lưu được. Kiểm tra lại thông tin.", "Failed to save.")}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (s: StaffMember) => {
    if (!confirm(t(`Tạm ngưng tài khoản của ${s.user.fullName}?`, `Deactivate ${s.user.fullName}?`))) return;
    try {
      await adminService.deactivateStaff(s.branchId, s.userId);
      showToast(t("✓ Đã tạm ngưng nhân viên", "✓ Staff deactivated"));
      void loadStaff();
    } catch {
      showToast(t("✗ Không thể cập nhật trạng thái", "✗ Failed to update status"));
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      ...emptyForm,
      branchId: selectedBranchId !== "all" ? selectedBranchId : "",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditTarget(s);
    setForm({
      fullName: s.user.fullName,
      email: s.user.email ?? "",
      phone: s.user.phone ?? "",
      gender: s.user.gender ?? "Unknown",
      position: s.position,
      branchId: s.branchId,
      startDate: "",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const locale = language === "en" ? "en-US" : "vi-VN";

  const positionLabel = (p: string) => {
    if (p === "technician") return t("Kỹ thuật viên", "Technician");
    if (p === "manager") return t("Quản lý", "Manager");
    return t("Lễ tân", "Receptionist");
  };

  const positionBadgeClass = (p: string) => {
    if (p === "technician") return "bg-secondary-container text-on-secondary-container";
    if (p === "manager") return "bg-primary-container text-on-primary-container";
    return "bg-tertiary-fixed text-on-tertiary-fixed";
  };

  const statusBadgeClass = (s: string) =>
    s === "active"
      ? "bg-green-50 text-green-700 border border-green-200"
      : "bg-surface-container text-on-surface-variant";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium">
            <Link href="/admin" className="hover:text-primary transition-colors">AuraSpa</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-primary font-bold">{t("Quản lý Nhân sự", "Staff Directory")}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold mt-1">
            {t("Đội ngũ Nhân sự Hệ thống", "System Personnel Directory")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t(
              "Quản lý Lễ tân & Kỹ thuật viên hoạt động tại từng chi nhánh AuraSpa.",
              "Manage receptionists & technicians at each AuraSpa branch."
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase whitespace-nowrap">{t("Chi nhánh:", "Branch:")}</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-outline-variant rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary bg-white font-medium"
            >
              <option value="all">{t("Tất cả chi nhánh", "All Branches")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{tService(b.name)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreate}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 font-bold shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
            {t("Thêm nhân viên", "Add Staff")}
          </button>
          <button
            onClick={() => void loadStaff()}
            className="border border-outline-variant px-4 py-2.5 rounded-full text-sm hover:bg-surface-container font-medium flex items-center gap-1 font-bold"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {t("Làm mới", "Refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("Tìm theo tên, mã NV, số điện thoại...", "Search by name, staff code, phone...")}
            className="w-full pl-9 pr-4 py-2 border border-outline-variant rounded-full text-sm bg-white focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          {["all", "technician", "receptionist", "manager"].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                roleFilter === role
                  ? "bg-primary text-on-primary shadow-sm"
                  : "border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              {role === "all" ? t("Tất cả", "All") : positionLabel(role)}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant shadow-sm">
          {t("Đang tải danh sách nhân sự...", "Loading personnel list...")}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant shadow-sm">
          <span className="material-symbols-outlined text-4xl block mb-2 text-outline">badge_off</span>
          <p className="font-label-md text-label-md">{t("Không tìm thấy nhân viên nào phù hợp", "No matching staff members found")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((staff) => (
            <article
              key={`${staff.branchId}-${staff.userId}`}
              className="bg-white rounded-2xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0">
                      {staff.user.fullName.split(" ").pop()?.[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-label-md text-sm text-on-surface font-bold truncate">{staff.user.fullName}</h3>
                      <p className="text-[10px] text-on-surface-variant mt-0.5 uppercase font-bold">
                        {staff.staffCode || t("Chưa có mã", "No code")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase shrink-0 ${positionBadgeClass(staff.position)}`}>
                    {positionLabel(staff.position)}
                  </span>
                </div>

                <div className="space-y-2 pt-3 border-t border-outline-variant/10 text-xs text-on-surface-variant font-medium">
                  <p className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>storefront</span>
                    {staff.branchName ? tService(staff.branchName) : t("Chi nhánh AuraSpa", "AuraSpa Branch")}
                  </p>
                  {staff.user.phone && (
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>call</span>
                      {staff.user.phone}
                    </p>
                  )}
                  {staff.user.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>mail</span>
                      {staff.user.email}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-[10px]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>calendar_today</span>
                    {t("Ngày vào:", "Join:")} {new Date(staff.startDate).toLocaleDateString(locale)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-outline-variant/10 flex justify-between items-center">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusBadgeClass(staff.status)}`}>
                  {staff.status === "active" ? t("Đang trực", "Active") : t("Ngưng", "Inactive")}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(staff)}
                    className="p-1.5 text-on-surface-variant hover:text-primary transition-colors"
                    title={t("Chỉnh sửa", "Edit")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  {staff.status === "active" && (
                    <button
                      onClick={() => void handleDeactivate(staff)}
                      className="p-1.5 text-on-surface-variant hover:text-error transition-colors"
                      title={t("Tạm ngưng", "Deactivate")}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal tạo/sửa nhân viên */}
      {showModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-outline-variant/10 pb-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {editTarget ? t("Chỉnh sửa nhân viên", "Edit Staff") : t("Thêm nhân viên mới", "Add New Staff")}
              </h2>
              <button onClick={() => { setShowModal(false); setFormErrors({}); }}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Họ tên */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Họ và tên *", "Full Name *")}
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => { setForm((p) => ({ ...p, fullName: e.target.value })); setFormErrors((p) => ({ ...p, fullName: "" })); }}
                  placeholder="Nguyễn Văn A"
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary ${formErrors.fullName ? "border-error" : "border-outline-variant"}`}
                />
                {formErrors.fullName && <p className="text-error text-xs mt-1">{formErrors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  readOnly={!!editTarget}
                  onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setFormErrors((p) => ({ ...p, email: "" })); }}
                  placeholder="staff@auraspa.vn"
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary ${formErrors.email ? "border-error" : "border-outline-variant"} ${editTarget ? "bg-surface-container text-on-surface-variant cursor-not-allowed" : ""}`}
                />
                {formErrors.email && <p className="text-error text-xs mt-1">{formErrors.email}</p>}
                {!editTarget && <p className="text-xs text-on-surface-variant/60 mt-1">{t("Mật khẩu mặc định sẽ tự động gửi qua email.", "Default password will be sent to this email.")}</p>}
              </div>

              {/* SĐT */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Số điện thoại", "Phone")}
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0912345678"
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Giới tính */}
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                    {t("Giới tính", "Gender")}
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="unknown">{t("Không xác định", "Unknown")}</option>
                    <option value="male">{t("Nam", "Male")}</option>
                    <option value="female">{t("Nữ", "Female")}</option>
                  </select>
                </div>

                {/* Vị trí */}
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                    {t("Vị trí *", "Position *")}
                  </label>
                  <select
                    value={form.position}
                    onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="technician">{t("Kỹ thuật viên", "Technician")}</option>
                    <option value="receptionist">{t("Lễ tân", "Receptionist")}</option>
                  </select>
                </div>
              </div>

              {/* Chi nhánh */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Chi nhánh *", "Branch *")}
                </label>
                {editTarget ? (
                  <div className="w-full border border-outline-variant/40 bg-surface-container text-on-surface-variant rounded-lg px-3 py-2 text-sm flex items-center gap-1 cursor-not-allowed">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                    {tService(branches.find((b) => b.id === form.branchId)?.name ?? form.branchId)}
                  </div>
                ) : (
                  <>
                    <select
                      value={form.branchId}
                      onChange={(e) => { setForm((p) => ({ ...p, branchId: e.target.value })); setFormErrors((p) => ({ ...p, branchId: "" })); }}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary bg-white ${formErrors.branchId ? "border-error" : "border-outline-variant"}`}
                    >
                      <option value="">-- {t("Chọn chi nhánh", "Select Branch")} --</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{tService(b.name)}</option>)}
                    </select>
                    {formErrors.branchId && <p className="text-error text-xs mt-1">{formErrors.branchId}</p>}
                  </>
                )}
              </div>

              {/* Ngày bắt đầu - chỉ khi tạo mới */}
              {!editTarget && (
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                    {t("Ngày bắt đầu", "Start Date")}
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => void handleSave()}
                disabled={isSubmitting}
                className="flex-1 bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold disabled:opacity-50"
              >
                {isSubmitting ? t("Đang lưu...", "Saving...") : t("Lưu", "Save")}
              </button>
              <button
                onClick={() => { setShowModal(false); setFormErrors({}); }}
                className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                {t("Hủy", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
