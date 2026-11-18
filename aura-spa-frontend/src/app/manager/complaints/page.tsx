"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { managerService } from "@/lib/services/manager.service";
import { getStatusColor } from "@/lib/mock-data";

type ComplaintStatus = "open" | "in_progress" | "resolved" | "rejected";

interface Complaint {
  id: string;
  customerName?: string;
  customer?: {
    fullName: string;
  };
  bookingId?: string;
  service?: {
    name: string;
  };
  date?: string;
  description: string;
  status: ComplaintStatus;
  resolutionNote?: string | null;
  createdAt?: string;
}

export default function ManagerComplaints() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const branchId = user?.branchId || "";
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resError, setResError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Helper for translation
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const getTranslatedStatus = (status: string) => {
    const map: Record<string, string> = {
      open: t("Mới", "New"),
      in_progress: t("Đang xử lý", "In Progress"),
      resolved: t("Đã giải quyết", "Resolved"),
      rejected: t("Từ chối", "Rejected"),
    };
    return map[status] ?? status;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadComplaints = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const data = await managerService.getComplaints(branchId);
      const complaintData = (data as unknown as Complaint[]) || [];
      setComplaints(complaintData);

      const queryComplaintId = new URLSearchParams(window.location.search).get("complaintId");
      if (queryComplaintId && complaintData.some((complaint) => complaint.id === queryComplaintId)) {
        setFilter("all");
        setSelected(queryComplaintId);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách khiếu nại:", err);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadComplaints(), 0);
    return () => window.clearTimeout(id);
  }, [loadComplaints]);

  const selectedItem = complaints.find((c) => c.id === selected);

  const handleResolve = async () => {
    if (!selected) return;
    if (!resolution.trim()) {
      setResError(t("Vui lòng nhập ghi chú giải quyết.", "Please enter a resolution note."));
      return;
    }
    try {
      await managerService.resolveComplaint(selected, { resolutionNote: resolution });
      setResError("");
      setSelected(null);
      setResolution("");
      showToast(t("✓ Khiếu nại đã được giải quyết", "✓ Complaint resolved successfully"));
      void loadComplaints();
    } catch {
      showToast(t("Lỗi xử lý khiếu nại.", "Error processing complaint."));
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      await managerService.rejectComplaint(selected, { resolutionNote: t("Từ chối khiếu nại", "Complaint rejected") });
      setSelected(null);
      showToast(t("✓ Khiếu nại đã bị từ chối", "✓ Complaint rejected"));
      void loadComplaints();
    } catch {
      showToast(t("Lỗi xử lý yêu cầu.", "Error processing request."));
    }
  };

  const handleSetInProgress = async (id: string) => {
    try {
      await managerService.setInProgressComplaint(id);
      showToast(t("✓ Đã cập nhật trạng thái đang xử lý", "✓ Status updated to In Progress"));
      void loadComplaints();
    } catch {
      showToast(t("Lỗi cập nhật trạng thái.", "Error updating status."));
    }
  };

  const filtered = filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t("Xử lý phản hồi khách hàng", "Customer Feedback Handling")}
        </h1>
        <button
          onClick={() => void loadComplaints()}
          className="border border-outline-variant px-4 py-2 rounded-full text-sm hover:bg-surface-container font-medium"
        >
          {t("Làm mới", "Refresh")}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: t("Tất cả", "All") },
          { key: "open", label: getTranslatedStatus("open") },
          { key: "in_progress", label: getTranslatedStatus("in_progress") },
          { key: "resolved", label: getTranslatedStatus("resolved") },
          { key: "rejected", label: getTranslatedStatus("rejected") },
        ].map((f) => {
          const labelText = f.label;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md text-sm transition-all ${
                filter === f.key
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              {labelText}
              {f.key !== "all" && (
                <span className="ml-1.5 text-xs">({complaints.filter((c) => c.status === f.key).length})</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl p-12 border border-outline-variant/20 text-center text-on-surface-variant font-medium">
          {t("Đang tải phản hồi từ khách hàng...", "Loading customer feedback...")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-3">
            {filtered.map((c) => {
              const customerName = c.customerName ?? c.customer?.fullName ?? `${t("Khách đặt lịch", "Customer Booking")} #${c.bookingId}`;
              const formattedDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString(language === "en" ? "en-US" : "vi-VN") : "";

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setResolution("");
                    setResError("");
                  }}
                  className={`bg-white rounded-2xl p-5 border-2 cursor-pointer transition-all ${
                    selected === c.id ? "border-primary shadow-sm" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <p className="font-label-md text-label-md text-on-surface font-bold truncate">{customerName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(c.status)}`}>
                      {getTranslatedStatus(c.status)}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    {c.service?.name ?? t("Dịch vụ", "Service")} · {formattedDate}
                  </p>
                  <p className="text-sm text-on-surface line-clamp-2">{c.description}</p>
                  {c.status === "open" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSetInProgress(c.id);
                      }}
                      className="mt-3 text-xs text-primary font-bold hover:underline"
                    >
                      {t("Bắt đầu xử lý →", "Start Processing →")}
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-10 border border-outline-variant/20 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2">check_circle</span>
                <p className="font-label-md text-label-md font-bold">
                  {t("Không có phản hồi nào", "No feedback available")}
                </p>
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="md:col-span-2">
            {selectedItem ? (
              <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-4 sticky top-6">
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {selectedItem.customerName ?? selectedItem.customer?.fullName ?? t("Khách hàng", "Customer")}
                    </h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${getStatusColor(selectedItem.status)}`}>
                      {getTranslatedStatus(selectedItem.status)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-on-surface-variant text-xs font-bold uppercase mb-0.5">{t("Dịch vụ", "Service")}</p>
                      <p className="font-medium text-sm">{selectedItem.service?.name ?? t("Dịch vụ Spa", "Spa Service")}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant text-xs font-bold uppercase mb-0.5">{t("Ngày gửi", "Date Submitted")}</p>
                      <p className="font-medium text-sm">
                        {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleDateString(language === "en" ? "en-US" : "vi-VN") : ""}
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">{t("Nội dung khiếu nại", "Complaint Description")}</p>
                    <p className="text-sm text-on-surface">{selectedItem.description}</p>
                  </div>
                </div>

                {selectedItem.resolutionNote && (
                  <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                    <p className="text-xs font-bold text-green-700 uppercase mb-1">{t("Kết quả giải quyết", "Resolution Note")}</p>
                    <p className="text-sm text-green-800">{selectedItem.resolutionNote}</p>
                  </div>
                )}

                {(selectedItem.status === "open" || selectedItem.status === "in_progress") && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 font-bold">
                        {t("Ghi chú giải quyết *", "Resolution Note *")}
                      </label>
                      <textarea
                        rows={3}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none ${
                          resError ? "border-error" : "border-outline-variant"
                        }`}
                        placeholder={t("Mô tả hành động giải quyết (hoàn tiền, tặng voucher, xin lỗi...)", "Describe resolution actions (refund, voucher gift, apology...)")}
                        value={resolution}
                        onChange={(e) => {
                          setResolution(e.target.value);
                          setResError("");
                        }}
                      />
                      {resError && <p className="text-error text-xs mt-1 font-medium">{resError}</p>}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleResolve}
                        className="flex-1 bg-primary text-on-primary py-3.5 rounded-full font-label-md text-label-md hover:opacity-90 font-bold text-sm shadow-sm"
                      >
                        {t("Giải quyết khiếu nại", "Resolve Complaint")}
                      </button>
                      <button
                        onClick={handleReject}
                        className="flex-1 border-2 border-error text-error py-3.5 rounded-full font-label-md text-label-md hover:bg-error-container/20 font-bold text-sm"
                      >
                        {t("Từ chối khiếu nại", "Reject Complaint")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl block mb-2 text-outline">forum</span>
                <p className="font-label-md text-label-md font-bold">
                  {t("Chọn một phản hồi ở bên trái để xem chi tiết và giải quyết", "Select a feedback on the left to view details and resolve")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
