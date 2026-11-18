"use client";
import { useCallback, useEffect, useState } from "react";
import { adminService } from "@/lib/services/admin.service";
import type { Branch } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

interface Manager {
  userId: string;
  staffCode: string | null;
  position: string;
  status: string;
  startDate: string;
  branchId: string;
  branchName?: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: string;
  };
}

type MgrForm = { fullName: string; email: string; phone: string; gender: string; branchId: string };
const emptyForm: MgrForm = { fullName: "", email: "", phone: "", gender: "unknown", branchId: "" };

export default function AdminManagers() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Manager | null>(null);
  const [form, setForm] = useState<MgrForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<MgrForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<Manager | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const branchList = await adminService.getBranches();
      setBranches(branchList || []);

      const results = await Promise.all(
        (branchList || []).map(async (b) => {
          try {
            const mgrs = await adminService.getBranchManagers(b.id);
            return mgrs
              .filter((m: any) => m.status === "active")
              .map((m: any) => ({ ...m, branchId: b.id, branchName: b.name }));
          } catch { return []; }
        })
      );
      setManagers(results.flat());
    } catch {
      setError(t("Không thể tải danh sách quản lý.", "Unable to load managers."));
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => { void loadData(); }, [loadData]);

  const branchesWithoutManager = branches.filter(
    (b) => !managers.some((m) => m.branchId === b.id)
  );

  const validate = () => {
    const e: Partial<MgrForm> = {};
    if (!form.fullName.trim()) e.fullName = t("Vui lòng nhập họ tên.", "Please enter full name.");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = t("Email không hợp lệ.", "Invalid email.");
    if (!form.branchId) e.branchId = t("Vui lòng chọn chi nhánh.", "Please select a branch.");
    setErrors(e);
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
      };
      if (editTarget) {
        const branchChanged = form.branchId !== editTarget.branchId;
        if (branchChanged) {
          await adminService.transferManager(editTarget.branchId, editTarget.userId, form.branchId);
          showToast(t("✓ Đã chuyển quản lý sang chi nhánh mới", "✓ Manager transferred to new branch"));
        } else {
          await adminService.updateManager(editTarget.branchId, editTarget.userId, payload);
          showToast(t("✓ Đã cập nhật quản lý", "✓ Manager updated"));
        }
      } else {
        await adminService.createManager(form.branchId, payload);
        showToast(t("✓ Đã tạo tài khoản manager", "✓ Manager account created"));
      }
      setShowModal(false);
      setEditTarget(null);
      setForm(emptyForm);
      setErrors({});
      void loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast(`✗ ${msg || t("Không lưu được.", "Failed to save.")}`, "err");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await adminService.deactivateManager(deactivateTarget.branchId, deactivateTarget.userId);
      await loadData();
      setDeactivateTarget(null);
      showToast(t("✓ Đã vô hiệu hóa quản lý", "✓ Manager deactivated"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast(`✗ ${msg || t("Không thể vô hiệu hóa.", "Failed to deactivate.")}`, "err");
    } finally {
      setIsDeactivating(false);
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (m: Manager) => {
    setEditTarget(m);
    setForm({
      fullName: m.user.fullName,
      email: m.user.email ?? "",
      phone: m.user.phone ?? "",
      gender: m.user.gender ?? "unknown",
      branchId: m.branchId,
    });
    setErrors({});
    setShowModal(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md ${
          toastType === "err" ? "bg-error text-on-error" : "bg-primary text-on-primary"
        }`}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            {t("Phân quyền quản lý chi nhánh", "Branch Management Delegation")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t("Tạo và phân công tài khoản Manager cho từng chi nhánh.", "Create and assign Manager accounts to branches.")}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 font-bold shadow-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          {t("Thêm Manager", "Add Manager")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error mb-4">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          {t("Đang tải danh sách quản lý...", "Loading managers...")}
        </div>
      )}

      {!isLoading && managers.length === 0 && (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 text-outline">manage_accounts</span>
          <p>{t("Chưa có manager nào được phân công.", "No managers assigned yet.")}</p>
        </div>
      )}

      {!isLoading && managers.length > 0 && (
        <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="bg-surface-container-low">
              <tr>
                {[
                  t("Quản lý", "Manager"),
                  t("Email / SĐT", "Email / Phone"),
                  t("Chi nhánh", "Branch"),
                  t("Ngày vào", "Join Date"),
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {managers.map((m) => (
                <tr key={`${m.branchId}-${m.userId}`} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                        {m.user.fullName.split(" ").pop()?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface font-bold truncate">{m.user.fullName}</p>
                        {m.staffCode && <p className="text-[10px] text-on-surface-variant uppercase truncate">{m.staffCode}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="truncate">{m.user.email}</p>
                    <p className="text-on-surface-variant mt-0.5">{m.user.phone || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="line-clamp-2 leading-snug">{m.branchName ? tService(m.branchName) : "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                    {new Date(m.startDate).toLocaleDateString(language === "en" ? "en-US" : "vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-center items-center">
                      <button
                        onClick={() => openEdit(m)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-colors whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                        {t("Chỉnh sửa", "Edit")}
                      </button>
                      <button
                        onClick={() => setDeactivateTarget(m)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-error bg-error-container/40 border border-error/20 rounded-full hover:bg-error-container transition-colors whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>block</span>
                        {t("Vô hiệu hóa", "Deactivate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-outline-variant/10 pb-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {editTarget ? t("Chỉnh sửa quản lý", "Edit Manager") : t("Tạo tài khoản Manager", "Create Manager Account")}
              </h2>
              <button onClick={() => { setShowModal(false); setErrors({}); }}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Họ và tên *", "Full Name *")}
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => { setForm((p) => ({ ...p, fullName: e.target.value })); setErrors((p) => ({ ...p, fullName: "" })); }}
                  placeholder="Nguyễn Văn A"
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary ${errors.fullName ? "border-error" : "border-outline-variant"}`}
                />
                {errors.fullName && <p className="text-error text-xs mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="mgr-email" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Email *</label>
                <input
                  id="mgr-email"
                  type="email"
                  value={form.email}
                  readOnly={!!editTarget}
                  onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => ({ ...p, email: "" })); }}
                  placeholder="manager@auraspa.vn"
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary ${errors.email ? "border-error" : "border-outline-variant"} ${editTarget ? "bg-surface-container text-on-surface-variant cursor-not-allowed" : ""}`}
                />
                {errors.email && <p className="text-error text-xs mt-1">{errors.email}</p>}
                {!editTarget && <p className="text-xs text-on-surface-variant/60 mt-1">{t("Mật khẩu mặc định sẽ tự động gửi qua email.", "Default password will be sent to this email.")}</p>}
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Số điện thoại", "Phone Number")}
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0912345678"
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                />
              </div>

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

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
                  {t("Chi nhánh phụ trách *", "Assigned Branch *")}
                </label>
                <select
                  value={form.branchId}
                  onChange={(e) => { setForm((p) => ({ ...p, branchId: e.target.value })); setErrors((p) => ({ ...p, branchId: "" })); }}
                  className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-primary bg-white ${errors.branchId ? "border-error" : "border-outline-variant"}`}
                >
                  <option value="">-- {t("Chọn chi nhánh", "Select Branch")} --</option>
                  {(editTarget
                    ? branches.filter(b => b.id === editTarget.branchId || branchesWithoutManager.some(f => f.id === b.id))
                    : branchesWithoutManager
                  ).map((b) => <option key={b.id} value={b.id}>{tService(b.name)}</option>)}
                </select>
                {errors.branchId && <p className="text-error text-xs mt-1">{errors.branchId}</p>}
                {editTarget && form.branchId !== editTarget.branchId && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
                    {t("Quản lý sẽ được chuyển sang chi nhánh mới.", "Manager will be transferred to the new branch.")}
                  </p>
                )}
              </div>
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
                onClick={() => { setShowModal(false); setErrors({}); }}
                className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                {t("Hủy", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirm Modal */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 20 }}>block</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {t("Xác nhận vô hiệu hóa", "Confirm Deactivation")}
                </h2>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {t("Hành động này sẽ:", "This action will:")}
                </p>
              </div>
            </div>

            <ul className="space-y-2 mb-5 text-sm">
              <li className="flex items-start gap-2 text-on-surface">
                <span className="material-symbols-outlined text-error shrink-0" style={{ fontSize: 16, marginTop: 1 }}>person_off</span>
                <span>
                  {t("Khóa tài khoản ", "Lock account of ")}
                  <span className="font-bold">{deactivateTarget.user.fullName}</span>
                  {t(" — không thể đăng nhập", " — cannot log in")}
                </span>
              </li>
              <li className="flex items-start gap-2 text-on-surface">
                <span className="material-symbols-outlined text-error shrink-0" style={{ fontSize: 16, marginTop: 1 }}>link_off</span>
                <span>
                  {t("Tách khỏi chi nhánh ", "Detach from branch ")}
                  <span className="font-bold">{deactivateTarget.branchName ?? deactivateTarget.branchId}</span>
                </span>
              </li>
              <li className="flex items-start gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-outline shrink-0" style={{ fontSize: 16, marginTop: 1 }}>warning</span>
                <span>{t("Không thể kích hoạt lại — nếu cần hãy tạo tài khoản mới", "Cannot be re-activated — create a new account if needed")}</span>
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => void handleDeactivate()}
                disabled={isDeactivating}
                className="flex-1 bg-error text-on-error py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold disabled:opacity-50"
              >
                {isDeactivating ? t("Đang xử lý...", "Processing...") : t("Vô hiệu hóa", "Deactivate")}
              </button>
              <button
                onClick={() => setDeactivateTarget(null)}
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
