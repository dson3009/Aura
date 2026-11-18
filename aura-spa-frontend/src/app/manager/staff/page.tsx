"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";

type StaffForm = { name: string; email: string; phone: string; role: string };
type StaffFilter = "working" | "on-duty" | "inactive" | "all";
type StaffUser = {
  id?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
};
type StaffAssignment = {
  branchId?: string;
  userId?: string;
  staffCode?: string | null;
  position?: string;
  status?: string;
  startDate?: string;
  user?: StaffUser;
  rating?: number | null;
};
type ActiveStaff = {
  staffId: string;
  rating?: number;
};
type RequestError = {
  response?: { data?: { message?: string } };
  message?: string;
};

const emptyForm: StaffForm = { name: "", email: "", phone: "", role: "technician" };

const getUserId = (item: StaffAssignment) => String(item.userId ?? item.user?.id ?? "");

function ManagerStaffContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const branchId = user?.branchId || "";

  const [staffList, setStaffList] = useState<StaffAssignment[]>([]);
  const [activeStaffList, setActiveStaffList] = useState<ActiveStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<StaffFilter>(filterParam === "active" ? "on-duty" : "working");
  const [showModal, setShowModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffAssignment | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<StaffForm>>({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [list, activeList] = await Promise.all([
        managerService.getStaff(branchId),
        managerService.getActiveStaff(branchId),
      ]);
      setStaffList((list || []) as StaffAssignment[]);
      setActiveStaffList((activeList || []) as ActiveStaff[]);
    } catch (err) {
      console.error("Error loading staff data:", err);
      showToast("Không thể tải danh sách nhân viên từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const activeStaffIds = useMemo(() => new Set(activeStaffList.map((s) => String(s.staffId))), [activeStaffList]);
  const activeStaffRatings = useMemo(() => new Map(activeStaffList.map((s) => [String(s.staffId), Number(s.rating) || 5])), [activeStaffList]);

  const workingCount = useMemo(() => staffList.filter((item) => item.status === "active").length, [staffList]);
  const inactiveCount = useMemo(() => staffList.filter((item) => item.status !== "active").length, [staffList]);

  const validate = () => {
    const e: Partial<StaffForm> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email không hợp lệ.";
    if (!form.phone.trim() || !/^(0|\+84)[0-9]{9}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "SĐT không hợp lệ.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      const payload = {
        fullName: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        position: form.role,
      };

      if (editId) {
        await managerService.updateStaff(branchId, editId, payload);
        showToast("Đã cập nhật thông tin nhân viên");
      } else {
        await managerService.createStaff(branchId, payload);
        showToast("Đã thêm nhân viên mới");
      }

      setShowModal(false);
      setEditId(null);
      setForm(emptyForm);
      setErrors({});
      loadData();
    } catch (err: unknown) {
      const error = err as RequestError;
      const msg = error.response?.data?.message || error.message;
      if (msg && msg.toLowerCase().includes("email")) {
        setErrors((p) => ({ ...p, email: "Email đã được sử dụng." }));
      } else {
        showToast(`Lỗi: ${msg || "Không thể lưu thông tin."}`);
      }
    }
  };

  const openCreate = () => {
    setShowModal(true);
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const handleEdit = (item: StaffAssignment) => {
    setForm({
      name: item.user?.fullName || "",
      email: item.user?.email || "",
      phone: item.user?.phone || "",
      role: item.position || "technician",
    });
    setEditId(getUserId(item));
    setShowModal(true);
    setErrors({});
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await managerService.deactivateStaff(branchId, getUserId(deactivateTarget));
      showToast("Đã ngừng việc nhân viên. Lịch hẹn sắp tới sẽ về trạng thái chưa phân công.");
      setDeactivateTarget(null);
      loadData();
    } catch (err: unknown) {
      const error = err as RequestError;
      showToast(`Lỗi: ${error.response?.data?.message || "Không thể ngừng việc nhân viên."}`);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staffList.filter((item) => {
      const userId = getUserId(item);
      const name = (item.user?.fullName || "").toLowerCase();
      const email = (item.user?.email || "").toLowerCase();
      const phone = (item.user?.phone || "").toLowerCase();
      const staffCode = (item.staffCode || "").toLowerCase();
      const matchesSearch = !query || name.includes(query) || email.includes(query) || phone.includes(query) || staffCode.includes(query);

      if (!matchesSearch) return false;
      if (filterType === "working") return item.status === "active" && activeStaffIds.has(userId);
      if (filterType === "on-duty") return item.status === "active" && !activeStaffIds.has(userId);
      if (filterType === "inactive") return item.status !== "active";
      return true;
    });
  }, [staffList, search, filterType, activeStaffIds]);

  const tabs: Array<{ key: StaffFilter; label: string; count: number; dot?: string }> = [
    { key: "working", label: "Đang làm", count: activeStaffIds.size, dot: "bg-green-500" },
    { key: "on-duty", label: "Đang nghỉ", count: workingCount - activeStaffIds.size, dot: "bg-stone-400" },
    { key: "inactive", label: "Đã nghỉ việc", count: inactiveCount, dot: "bg-red-400" },
    { key: "all", label: "Tất cả", count: staffList.length },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Quản lý nhân viên</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Theo dõi nhân viên đang làm việc tại cửa hàng, nhân viên đang nghỉ ca và nhân sự đã nghỉ việc tại chi nhánh.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Thêm nhân viên
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterType(tab.key)}
            className={`text-left rounded-lg border px-4 py-3 transition-colors ${
              filterType === tab.key
                ? "border-primary bg-primary/5 text-primary"
                : "border-outline-variant/40 bg-white text-on-surface hover:border-primary/50"
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              {tab.dot && <span className={`h-2.5 w-2.5 rounded-full ${tab.dot}`} />}
              {tab.label}
            </span>
            <span className="mt-1 block text-xl font-bold">{tab.count}</span>
          </button>
        ))}
      </div>

      <input
        className="w-full border border-outline-variant/60 rounded-xl px-4 py-3 focus:outline-none focus:border-primary bg-white text-sm"
        placeholder="Tìm nhân viên theo tên, email, số điện thoại hoặc mã nhân viên..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant text-sm font-medium">Đang tải danh sách nhân viên...</div>
      ) : (
        <div className="bg-white rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
          <table className="w-full table-fixed text-left border-collapse">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-surface-container-low">
              <tr>
                {["Nhân viên", "Liên hệ", "Vai trò", "Chuyên môn", "Đánh giá", "Trực ca", "Trạng thái", "Thao tác"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-bold uppercase text-on-surface-variant"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-on-surface-variant">
                    Không tìm thấy nhân viên phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const userId = getUserId(item);
                  const onDuty = activeStaffIds.has(userId);
                  const isWorking = item.status === "active";
                  const rating = item.rating ?? 5.0;
                  const joinDateStr = item.startDate ? new Date(item.startDate).toLocaleDateString("vi-VN") : "-";
                  const displaySpecialization = item.position === "technician" ? "Massage body, trị liệu" : "Hỗ trợ khách hàng";

                  return (
                    <tr key={`${item.branchId ?? branchId}-${userId}`} className={!isWorking ? "bg-red-50/20 text-on-surface-variant" : "hover:bg-surface-container-lowest"}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                            {item.user?.fullName?.split(" ").pop()?.[0] || "S"}
                            {onDuty && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate">{item.user?.fullName}</p>
                            <p className="text-[11px] text-on-surface-variant">Từ {joinDateStr}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <p className="font-medium text-on-surface break-words">{item.user?.email || "-"}</p>
                        <p className="text-on-surface-variant">{item.user?.phone || "-"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[86px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            item.position === "technician"
                              ? "bg-primary/10 text-primary"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none">
                            {item.position === "technician" ? "spa" : "support_agent"}
                          </span>
                          {item.position === "technician" ? "Kỹ thuật" : "Lễ tân"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-on-surface-variant">{displaySpecialization}</td>
                      <td className="px-5 py-4 text-xs font-bold text-primary">★ {rating.toFixed(1)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[78px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            onDuty ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              onDuty ? "bg-green-600" : "bg-stone-400"
                            }`}
                          />
                          {onDuty ? "Đang làm" : "Đang nghỉ"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[88px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isWorking ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isWorking ? "bg-emerald-600" : "bg-red-500"
                            }`}
                          />
                          {isWorking ? "Hoạt động" : "Đã nghỉ việc"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary"
                            title="Chỉnh sửa"
                            aria-label="Chỉnh sửa nhân viên"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {isWorking ? (
                            <button
                              onClick={() => setDeactivateTarget(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-red-50 hover:text-red-700"
                              title="Ngừng việc"
                              aria-label="Ngừng việc nhân viên"
                            >
                              <span className="material-symbols-outlined text-[18px]">person_off</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-on-surface-variant">Không thao tác</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {editId ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}
              </h2>
              <button onClick={() => setShowModal(false)} aria-label="Đóng">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Họ và tên", key: "name", type: "text", placeholder: "Nguyễn Văn A" },
                { label: "Email", key: "email", type: "email", placeholder: "example@auraspa.vn" },
                { label: "Số điện thoại", key: "phone", type: "tel", placeholder: "0912345678" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1 text-xs font-bold">{label}</label>
                  <input
                    type={type}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary ${errors[key as keyof StaffForm] ? "border-error" : "border-outline-variant/80"}`}
                    placeholder={placeholder}
                    value={form[key as keyof StaffForm]}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, [key]: e.target.value }));
                      setErrors((p) => ({ ...p, [key]: "" }));
                    }}
                  />
                  {errors[key as keyof StaffForm] && <p className="text-error text-[11px] mt-1 font-semibold">{errors[key as keyof StaffForm]}</p>}
                </div>
              ))}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1 text-xs font-bold">Vai trò</label>
                <select
                  className="w-full border border-outline-variant/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="technician">Kỹ thuật viên (KTV)</option>
                  <option value="receptionist">Lễ tân</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={handleSave} className="flex-1 bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold">
                Lưu
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container font-semibold">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Ngừng việc nhân viên?</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Nhân viên <span className="font-bold text-on-surface">{deactivateTarget.user?.fullName}</span> sẽ không còn được phân công booking tại chi nhánh này.
                Lịch sử booking, hóa đơn và đánh giá vẫn được giữ để đối soát.
              </p>
            </div>
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Đây là thao tác ngừng việc, không phải xoá cứng tài khoản khỏi hệ thống.
            </div>
            <div className="flex gap-3">
              <button onClick={confirmDeactivate} className="flex-1 bg-red-700 text-white py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold">
                Ngừng việc
              </button>
              <button onClick={() => setDeactivateTarget(null)} className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container font-semibold">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagerStaff() {
  return (
    <Suspense fallback={null}>
      <ManagerStaffContent />
    </Suspense>
  );
}
