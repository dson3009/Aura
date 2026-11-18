"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { strategyService, type Strategy } from "@/lib/services/strategy.service";
import { aiFlags, aiService } from "@/lib/services/ai.service";
import type { ReactNode } from "react";

function confidenceTone(c: number | null | undefined) {
  if (c == null) return "bg-surface-container text-on-surface-variant";
  if (c >= 0.7) return "bg-green-50 text-green-800 border border-green-200";
  if (c >= 0.5) return "bg-amber-50 text-amber-900 border border-amber-200";
  return "bg-red-50 text-red-800 border border-red-200";
}

function priorityLabel(p: "high" | "medium" | "low", language: string) {
  if (language === "en") {
    return p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
  }
  return p === "high" ? "Cao" : p === "medium" ? "TB" : "Thấp";
}

function priorityPillClass(p: "high" | "medium" | "low") {
  if (p === "high") return "bg-error/10 text-error border-error/20";
  if (p === "medium") return "bg-secondary/10 text-secondary border-secondary/25";
  return "bg-surface-container text-on-surface-variant border-outline-variant/30";
}

function sanitizeBadge(badge: string | null | undefined, language: string) {
  const raw = (badge || "").trim();
  // Avoid showing raw confidence words as category badges
  if (!raw || /^(high|medium|low)$/i.test(raw)) {
    return language === "en" ? "Operations" : "Vận hành";
  }
  const normalized = raw.toLowerCase();
  if (language !== "en") {
    if (normalized === "retention") return "Giữ chân khách";
    if (normalized === "marketing") return "Tiếp thị";
    if (normalized === "operations" || normalized === "operation") return "Vận hành";
  }
  return raw;
}

export default function AdminStrategies() {
  const { language } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  type ConfirmCfg = {
    title: string;
    bullets?: ReactNode[];
    confirmLabel: string;
    action: () => Promise<void>;
  };
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [badge, setBadge] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [status, setStatus] = useState<"proposed" | "active" | "completed">("proposed");

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    setIsLoading(true);
    strategyService.getAll()
      .then(setStrategies)
      .catch(() => setLoadError(t("Không tải được danh sách chiến lược.", "Failed to load strategies.")))
      .finally(() => setIsLoading(false));
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedStrategy(null);
    setTitle("");
    setDesc("");
    setBadge(t("Đề xuất", "Proposed"));
    setPriority("medium");
    setStatus("proposed");
    setModalOpen(true);
  };

  const openEditModal = (strat: Strategy) => {
    setModalMode("edit");
    setSelectedStrategy(strat);
    setTitle(strat.title);
    setDesc(strat.description);
    setBadge(strat.badge);
    setPriority(strat.priority);
    setStatus(strat.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) {
      showToast(t("Vui lòng điền đầy đủ các thông tin bắt buộc.", "Please fill in all required fields."), "error");
      return;
    }
    setIsSaving(true);
    try {
      if (modalMode === "create") {
        const created = await strategyService.create({
          title: title.trim(),
          description: desc.trim(),
          badge: badge.trim() || t("Chiến lược", "Strategy"),
          priority,
          status,
        });
        setStrategies((prev) => [created, ...prev]);
        showToast(t("Đã thêm chiến lược mới.", "Strategy created."));
      } else if (modalMode === "edit" && selectedStrategy) {
        const updated = await strategyService.update(selectedStrategy.id, {
          title: title.trim(),
          description: desc.trim(),
          badge: badge.trim(),
          priority,
          status,
        });
        setStrategies((prev) => prev.map((s) => (s.id === selectedStrategy.id ? updated : s)));
        showToast(t("Đã cập nhật chiến lược.", "Strategy updated."));
      }
      setModalOpen(false);
    } catch {
      showToast(t("Không lưu được chiến lược. Vui lòng thử lại.", "Could not save strategy. Please try again."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const strat = strategies.find((s) => s.id === id);
    if (!strat) return;
    setConfirmCfg({
      title: t("Xóa chiến lược này?", "Delete This Strategy?"),
      bullets: [
        language === "en"
          ? <span>Strategy <strong>{strat.title}</strong> will be permanently deleted</span>
          : <span>Chiến lược <strong>{strat.title}</strong> sẽ bị xóa vĩnh viễn</span>,
        t("Thao tác này không thể hoàn tác", "This action cannot be undone"),
      ],
      confirmLabel: t("Xóa chiến lược", "Delete Strategy"),
      action: async () => {
        await strategyService.remove(strat.id);
        setStrategies((prev) => prev.filter((s) => s.id !== id));
        showToast(t("Đã xoá chiến lược.", "Strategy deleted."));
      },
    });
  };

  const handleGenerateAi = async () => {
    if (!aiFlags.strategy || isGenerating) return;
    setIsGenerating(true);
    setGenerateError("");
    try {
      const created = await aiService.generateStrategies({ maxStrategies: 3 });
      const list = (Array.isArray(created) ? created : []) as Strategy[];
      setStrategies((prev) => [...list, ...prev]);
      showToast(
        list.length > 0
          ? t(`Đã tạo ${list.length} chiến lược đề xuất.`, `${list.length} suggested strategies created.`)
          : t("Không có đề xuất mới từ số liệu.", "No new metric suggestions were created."),
      );
    } catch (err) {
      showToast(t("Không sinh được chiến lược từ số liệu.", "Could not generate metric suggestions."), "error");
      setGenerateError(
        err instanceof Error
          ? err.message
          : t("Không sinh được chiến lược AI. Thử lại sau.", "Could not generate AI strategies."),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = (strat: Strategy) => {
    setConfirmCfg({
      title: t("Kích hoạt chiến lược này?", "Activate this strategy?"),
      bullets: [
        t("Đề xuất từ số liệu — Owner quyết định kích hoạt.", "Data-driven suggestion — Owner decides activation."),
        language === "en" ? (
          <span>
            Strategy <strong>{strat.title}</strong> will become <strong>active</strong>
          </span>
        ) : (
          <span>
            Chiến lược <strong>{strat.title}</strong> sẽ chuyển sang <strong>đang chạy</strong>
          </span>
        ),
      ],
      confirmLabel: t("Duyệt & kích hoạt", "Approve & activate"),
      action: async () => {
        const updated = await strategyService.update(strat.id, { status: "active" });
        setStrategies((prev) => prev.map((s) => (s.id === strat.id ? updated : s)));
        showToast(t("Đã duyệt và kích hoạt chiến lược.", "Strategy approved and activated."));
      },
    });
  };

  const handleComplete = (strat: Strategy) => {
    setConfirmCfg({
      title: t("Đánh dấu chiến lược đã hoàn thành?", "Mark this strategy as completed?"),
      bullets: [
        t("Chiến lược sẽ rời trạng thái đang chạy.", "The strategy will leave the active status."),
        language === "en" ? (
          <span>
            Strategy <strong>{strat.title}</strong> will become <strong>completed</strong>
          </span>
        ) : (
          <span>
            Chiến lược <strong>{strat.title}</strong> sẽ chuyển sang <strong>đã hoàn thành</strong>
          </span>
        ),
      ],
      confirmLabel: t("Đánh dấu hoàn thành", "Mark completed"),
      action: async () => {
        const updated = await strategyService.update(strat.id, { status: "completed" });
        setStrategies((prev) => prev.map((s) => (s.id === strat.id ? updated : s)));
        showToast(t("Đã đánh dấu chiến lược hoàn thành.", "Strategy marked as completed."));
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmCfg) return;
    try {
      await confirmCfg.action();
      setConfirmCfg(null);
    } catch {
      showToast(t("Không thể thực hiện thao tác. Vui lòng thử lại.", "Could not complete the action. Please try again."), "error");
    }
  };

  const proposedStrategies = strategies.filter((s) => s.status === "proposed");
  const activeStrategies = strategies.filter((s) => s.status === "active");
  const completedStrategies = strategies.filter((s) => s.status === "completed");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[70] max-w-sm rounded-xl px-5 py-3 text-sm font-bold shadow-lg ${
            toast.tone === "error" ? "bg-error text-on-error" : "bg-primary text-on-primary"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium">
            <Link href="/admin" className="hover:text-primary transition-colors">AuraSpa</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-primary font-bold">{t("Quản lý Chiến lược", "Strategy Management")}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold mt-1">
            {t("Danh sách Chiến lược Đề xuất", "Proposed Strategies List")}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t(
              "Quản lý chiến lược vận hành, tiếp thị và nhân sự. Đề xuất từ số liệu chỉ mang tính tham khảo — Owner quyết định.",
              "Manage operations, marketing and staffing strategies. Metric-based suggestions are advisory — Owner decides."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {aiFlags.strategy && (
            <button
              type="button"
              onClick={() => void handleGenerateAi()}
              disabled={isGenerating}
              className="bg-primary/10 text-primary border border-primary/30 px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:bg-primary hover:text-white transition-colors font-bold shadow-sm w-fit disabled:opacity-60 min-h-[44px]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {isGenerating ? "progress_activity" : "insights"}
              </span>
              {isGenerating
                ? t("Đang phân tích số liệu...", "Analyzing metrics...")
                : t("Gợi ý từ số liệu", "Suggest from metrics")}
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity font-bold shadow-sm w-fit min-h-[44px]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            {t("Thêm chiến lược", "Add Strategy")}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-6 text-sm text-on-surface-variant">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            <div>
              <p className="font-bold text-primary">{t("Đang tổng hợp đề xuất...", "Preparing suggestions...")}</p>
              <p className="text-xs mt-1">
                {t(
                  "Đang đọc doanh thu, xếp hạng chi nhánh & dịch vụ (8–20s).",
                  "Reading revenue, branch & service rankings (8–20s).",
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white/70 animate-pulse border border-outline-variant/10" />
            ))}
          </div>
        </div>
      )}

      {generateError && (
        <div className="rounded-xl border border-error-container bg-error-container/20 px-4 py-3 text-sm text-error flex justify-between gap-2">
          <span className="min-w-0 break-words">{generateError}</span>
          <button type="button" className="font-bold underline shrink-0" onClick={() => void handleGenerateAi()}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2 block animate-spin">progress_activity</span>
          <p className="font-label-md text-label-md">{t("Đang tải...", "Loading...")}</p>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-error-container bg-error-container/20 px-4 py-3 text-sm text-error">{loadError}</div>
      )}

      {!isLoading && (strategies?.length ?? 0) === 0 && !loadError && (
        <div className="rounded-2xl border border-dashed border-outline-variant/40 px-6 py-12 text-center space-y-3">
          <p className="font-bold text-on-surface">{t("Chưa có chiến lược", "No strategies yet")}</p>
          <p className="text-sm text-on-surface-variant">
            {t(
              "Thêm thủ công hoặc gợi ý từ số liệu vận hành 30 ngày gần nhất.",
              "Add manually or suggest from the last 30 days of operations data.",
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={openCreateModal} className="rounded-full bg-primary text-on-primary px-4 py-2 text-sm font-bold min-h-[44px]">
              {t("Thêm thủ công", "Add manually")}
            </button>
            {aiFlags.strategy && (
              <button type="button" onClick={() => void handleGenerateAi()} className="rounded-full border border-primary text-primary px-4 py-2 text-sm font-bold min-h-[44px]">
                {t("Gợi ý từ số liệu", "Suggest from metrics")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spotlight: top proposed — visible without expanding detail */}
      {!isLoading && (strategies ?? []).some((s) => s.status === "proposed") && (
        <section className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-on-surface">
                {t("Cần xem xét ngay", "Needs your review")}
              </h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {t("Các đề xuất ưu tiên — bạn quyết định duyệt hay chỉnh sửa.", "Priority proposals — you decide to approve or edit.")}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary/80 shrink-0">
              {(strategies ?? []).filter((s) => s.status === "proposed").length}{" "}
              {t("đề xuất", "proposed")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(strategies ?? [])
              .filter((s) => s.status === "proposed")
              .sort((a, b) => {
                const rank = { high: 0, medium: 1, low: 2 } as const;
                return rank[a.priority] - rank[b.priority];
              })
              .slice(0, 2)
              .map((strat) => (
                <div
                  key={`spot-${strat.id}`}
                  className="bg-white rounded-xl border border-outline-variant/20 p-4 flex flex-col gap-2 min-w-0 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant uppercase truncate max-w-[60%]">
                      {sanitizeBadge(strat.badge, language)}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityPillClass(strat.priority)}`}
                      title={t("Mức ưu tiên", "Priority")}
                    >
                      {priorityLabel(strat.priority, language)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface break-words">{strat.title}</h3>
                  <p className="text-xs text-on-surface-variant break-words leading-relaxed whitespace-pre-line">
                    {strat.description}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                    <button
                      type="button"
                      onClick={() => handleApprove(strat)}
                      className="rounded-full bg-green-50 text-green-800 hover:bg-green-600 hover:text-white px-3 py-1.5 text-[11px] font-bold min-h-[36px] transition-colors"
                    >
                      {t("Duyệt", "Approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedId(strat.id);
                        document.getElementById(`strategy-card-${strat.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="rounded-full border border-outline-variant/40 text-on-surface-variant px-3 py-1.5 text-[11px] font-bold min-h-[36px] hover:border-primary hover:text-primary transition-colors"
                    >
                      {t("Xem chi tiết", "View details")}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {[
        {
          key: "proposed",
          title: t("Đề xuất", "Proposed"),
          description: t("Các chiến lược đang chờ owner duyệt hoặc chỉnh sửa.", "Strategies awaiting owner approval or edits."),
          items: proposedStrategies,
        },
        {
          key: "active",
          title: t("Đang chạy", "Active"),
          description: t("Các chiến lược đã duyệt và đang áp dụng.", "Approved strategies currently in use."),
          items: activeStrategies,
        },
        {
          key: "completed",
          title: t("Hoàn thành", "Completed"),
          description: t("Các chiến lược đã kết thúc.", "Strategies that have been completed."),
          items: completedStrategies,
        },
      ].map((section) => (
        <section key={section.key} className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-on-surface">{section.title}</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{section.description}</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase text-primary/80">
              {section.items.length} {t("chiến lược", "strategies")}
            </span>
          </div>
          {section.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-white px-5 py-8 text-center text-sm text-on-surface-variant">
              {t("Chưa có chiến lược trong mục này.", "No strategies in this section.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
              {section.items.map((strat) => (
          <article
            id={`strategy-card-${strat.id}`}
            key={strat.id}
            className={`bg-white rounded-2xl border p-4 md:p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col min-w-0 overflow-hidden ${
              strat.priority === "high"
                ? "border-l-4 border-l-primary border-outline-variant/20"
                : strat.priority === "medium"
                ? "border-l-4 border-l-secondary border-outline-variant/20"
                : "border-l-4 border-l-outline border-outline-variant/20"
            } ${strat.source === "ai_generated" && (strat.aiConfidence ?? 1) < 0.5 ? "ring-1 ring-amber-300" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                  <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant uppercase max-w-full truncate">
                    {sanitizeBadge(strat.badge, language)}
                  </span>
                  {strat.source === "ai_generated" ? (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant"
                      title={t("Sinh từ số liệu hệ thống", "Generated from system metrics")}
                    >
                      {t("Từ số liệu", "From data")}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                      {t("Thủ công", "Manual")}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    strat.status === "proposed"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : strat.status === "active"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {strat.status === "proposed"
                    ? t("Đề xuất", "Proposed")
                    : strat.status === "active"
                    ? t("Đang chạy", "Active")
                    : t("Hoàn thành", "Completed")}
                </span>
              </div>

              {strat.source === "ai_generated" && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${confidenceTone(strat.aiConfidence)}`}
                    title={t("Độ tin cậy dựa trên độ đầy đủ dữ liệu", "Confidence from data density")}
                  >
                    {strat.aiConfidence != null
                      ? `${Math.round(Number(strat.aiConfidence) * 100)}%`
                      : "—"}
                  </span>
                  {strat.aiConfidence != null && Number(strat.aiConfidence) < 0.5 && (
                    <span className="text-[10px] text-amber-800 font-medium leading-snug">
                      {t("Dữ liệu mỏng — xem kỹ", "Thin data — review carefully")}
                    </span>
                  )}
                </div>
              )}

              <h3 className="font-label-md text-sm text-on-surface font-bold mb-2 break-words">
                {strat.title}
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-3 break-words whitespace-pre-line">
                {strat.description}
              </p>

              {strat.source === "ai_generated" && (
                <button
                  type="button"
                  className="text-[11px] font-bold text-primary mb-2"
                  onClick={() => setExpandedId(expandedId === strat.id ? null : strat.id)}
                >
                  {expandedId === strat.id
                    ? t("Ẩn dữ liệu hỗ trợ", "Hide supporting data")
                    : t("Xem dữ liệu hỗ trợ", "View supporting data")}
                </button>
              )}
              {expandedId === strat.id && strat.supportingData && (
                <div className="mb-3 rounded-xl bg-surface-container/60 px-3 py-2 text-[11px] text-on-surface-variant space-y-1.5 min-w-0">
                  {Array.isArray((strat.supportingData as { highlights?: string[] }).highlights) &&
                    ((strat.supportingData as { highlights: string[] }).highlights || []).map((h, i) => (
                      <p key={i} className="break-words leading-snug">
                        • {h}
                      </p>
                    ))}
                  <Link href="/admin/revenue" className="inline-block mt-1 font-bold text-primary underline">
                    {t("Xem dashboard doanh thu", "Open revenue dashboard")}
                  </Link>
                </div>
              )}
            </div>

            {/* Footer: priority pill (compact) + actions — no long wrapping labels */}
            <div className="flex flex-col gap-2.5 pt-3 mt-auto border-t border-outline-variant/10">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${priorityPillClass(strat.priority)}`}
                >
                  {priorityLabel(strat.priority, language)}
                </span>
                <span className="text-[10px] text-on-surface-variant truncate">
                  {t("ưu tiên", "priority")}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {strat.status === "proposed" && (
                  <button
                    type="button"
                    onClick={() => handleApprove(strat)}
                    className="bg-green-50 hover:bg-green-600 hover:text-white text-green-800 px-2.5 py-1.5 rounded-full transition-colors text-[10px] font-bold min-h-[36px]"
                  >
                    {t("Duyệt", "Approve")}
                  </button>
                )}
                {strat.status === "active" && (
                  <button
                    type="button"
                    onClick={() => handleComplete(strat)}
                    className="bg-green-50 hover:bg-green-600 hover:text-white text-green-800 px-2.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1 text-[10px] font-bold min-h-[36px]"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                      check_circle
                    </span>
                    {t("Hoàn thành", "Complete")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(strat)}
                  className="bg-primary/10 hover:bg-primary hover:text-white text-primary px-2.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1 text-[10px] font-bold min-h-[36px]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    edit
                  </span>
                  {t("Sửa", "Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(strat.id)}
                  className="bg-error-container/20 hover:bg-error hover:text-white text-error px-2.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1 text-[10px] font-bold min-h-[36px]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    delete
                  </span>
                  {t("Xoá", "Delete")}
                </button>
              </div>
            </div>
          </article>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={!!confirmCfg}
        icon="delete_forever"
        title={confirmCfg?.title ?? ""}
        bullets={confirmCfg?.bullets}
        confirmLabel={confirmCfg?.confirmLabel ?? t("Xóa", "Delete")}
        variant="danger"
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setConfirmCfg(null)}
      />

      {/* CRUD Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {modalMode === "create" ? t("Thêm chiến lược mới", "Add New Strategy") : t("Chỉnh sửa chiến lược", "Edit Strategy")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Tiêu đề chiến lược *", "Strategy Title *")}</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("VD: Điều phối ca tối Quận 1", "e.g., Night shift delegation Q1")}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Phân loại/Nhãn *", "Category/Label *")}</label>
                <input
                  type="text"
                  required
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder={t("VD: Quan trọng, Nhân sự, Xu hướng...", "e.g., Critical, Staff, Trending...")}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mức độ ưu tiên", "Priority")}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="high">{t("Cao", "High")}</option>
                    <option value="medium">{t("Trung bình", "Medium")}</option>
                    <option value="low">{t("Thấp", "Low")}</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Trạng thái", "Status")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="proposed">{t("Đề xuất", "Proposed")}</option>
                    <option value="active">{t("Đang áp dụng", "Active")}</option>
                    <option value="completed">{t("Đã hoàn thành", "Completed")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-on-surface-variant font-bold uppercase">{t("Mô tả chiến lược *", "Strategy Description *")}</label>
                <textarea
                  rows={4}
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("Mô tả cụ thể định hướng chiến lược hoặc đề xuất...", "Detailed operational description or proposal direction...")}
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
                  disabled={isSaving}
                  className="flex-1 bg-primary text-on-primary rounded-full py-2.5 text-sm hover:opacity-90 font-bold disabled:opacity-60"
                >
                  {isSaving ? t("Đang lưu...", "Saving...") : t("Lưu", "Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
