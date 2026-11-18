"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  aiService,
  type ConciergeMessage,
  type ConciergeResponse,
  type UiAction,
} from "@/lib/services/ai.service";

/** v2 drops legacy "Aura AI" welcome / branding in stored transcripts */
const STORAGE_KEY = "auraspa_chat_booking_v2";
const LEGACY_STORAGE_KEYS = ["auraspa_ai_chat_v1"];
const MAX_LEN = 500;

const QUICK_CHIPS = [
  "Chi nhánh đang mở",
  "Dịch vụ Facial",
  "Slot ngày mai",
  "Tôi muốn gặp nhân viên",
];

const WELCOME_TEXT =
  "Xin chào! Mình có thể giúp tìm **chi nhánh**, **dịch vụ** hoặc **slot trống** — thông tin lấy trực tiếp từ hệ thống Aura Spa.";

type ChatBubble = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: UiAction[];
  toolStatus?: string;
};

function welcomeBubble(): ChatBubble {
  // Chips live in the sticky footer — avoid duplicating in the welcome bubble
  return { id: "welcome", role: "assistant", content: WELCOME_TEXT };
}

function isLegacyBrandedHistory(bubbles: ChatBubble[]): boolean {
  return bubbles.some((b) =>
    /Aura AI|AI Concierge|Gợi ý đặt lịch bằng AI/i.test(b.content || ""),
  );
}

function loadHistory(): ChatBubble[] {
  if (typeof window === "undefined") return [];
  try {
    // Migrate / discard old keys with branded copy
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as ChatBubble[];
          if (Array.isArray(parsed) && !isLegacyBrandedHistory(parsed) && parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.slice(-50)));
          }
        } catch {
          /* ignore */
        }
        localStorage.removeItem(key);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatBubble[];
    if (!Array.isArray(parsed) || !parsed.length) return [];
    if (isLegacyBrandedHistory(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.slice(-50);
  } catch {
    return [];
  }
}

export default function AiConciergePanel({
  onEscalateHuman,
}: {
  onEscalateHuman?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "pending" | "tool" | "error">("idle");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ConciergeResponse["bookingDraft"]>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const hist = loadHistory();
      setBubbles(hist.length ? hist : [welcomeBubble()]);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && confirmOpen) {
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (bubbles.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bubbles.slice(-50)));
    }
  }, [bubbles]);

  useEffect(() => {
    if (stickBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [bubbles, phase]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottom.current = dist < 80;
  };

  const toApiMessages = (list: ChatBubble[]): ConciergeMessage[] =>
    list
      .filter((b) => b.role === "user" || b.role === "assistant")
      .map((b) => ({ role: b.role as "user" | "assistant", content: b.content }));

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, MAX_LEN);
      if (!trimmed || sending) return;

      setSending(true);
      setError("");
      setPhase("pending");
      const userBubble: ChatBubble = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setBubbles((prev) => [...prev, userBubble]);
      setInput("");

      const toolTimer = window.setTimeout(() => setPhase("tool"), 600);

      try {
        const history = [...bubbles.filter((b) => b.role !== "system"), userBubble];
        const res = await aiService.conciergeChat({
          messages: toApiMessages(history),
          locale: "vi",
        });

        if (res.bookingDraft) setDraft(res.bookingDraft);

        const toolHint =
          res.toolTrace?.length > 0
            ? res.toolTrace.map((t) => t.summary).join(" · ")
            : undefined;

        const assistant: ChatBubble = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.assistantMessage || "Xin lỗi, mình chưa trả lời được.",
          actions: res.uiActions,
          toolStatus: toolHint,
        };
        setBubbles((prev) => [...prev, assistant]);

        if (res.escalateToHuman) {
          setBubbles((prev) => [
            ...prev,
            {
              id: `s-${Date.now()}`,
              role: "system",
              content: "Đã sẵn sàng chuyển sang nhân viên tư vấn.",
            },
          ]);
          onEscalateHuman?.();
        }
        setPhase("idle");
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Gặp lỗi khi hỗ trợ đặt lịch. Thử lại sau.");
        setBubbles((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "system",
            content: "Không nhận được phản hồi AI. Bạn có thể Thử lại hoặc chat Nhân viên.",
          },
        ]);
      } finally {
        window.clearTimeout(toolTimer);
        setSending(false);
        setPhase((p) => (p === "pending" || p === "tool" ? "idle" : p));
      }
    },
    [bubbles, sending, onEscalateHuman],
  );

  const regenerate = async () => {
    const lastUser = [...bubbles].reverse().find((b) => b.role === "user");
    if (!lastUser) return;
    // remove last assistant after that user
    setBubbles((prev) => {
      const idx = prev.lastIndexOf(lastUser);
      return prev.slice(0, idx + 1);
    });
    await sendText(lastUser.content);
  };

  const handleAction = async (action: UiAction) => {
    if (action.type === "quick_reply") {
      await sendText(action.label);
      return;
    }
    if (action.type === "deep_link" && action.href) {
      router.push(action.href);
      return;
    }
    if (action.type === "login") {
      router.push(action.href || "/login");
      return;
    }
    if (action.type === "escalate_human") {
      onEscalateHuman?.();
      return;
    }
    if (action.type === "confirm_booking") {
      setDraft((action.payload as ConciergeResponse["bookingDraft"]) || draft);
      setConfirmOpen(true);
    }
  };

  const confirmBooking = async () => {
    if (!draft || !user) {
      router.push("/login");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await aiService.conciergeChat({
        messages: toApiMessages(bubbles),
        confirmBooking: true,
        bookingDraft: draft,
      });
      setBubbles((prev) => [
        ...prev,
        {
          id: `a-book-${Date.now()}`,
          role: "assistant",
          content: res.assistantMessage,
          actions: res.uiActions,
        },
      ]);
      if (res.bookingCreated) {
        setDraft(null);
        setConfirmOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt lịch thất bại");
    } finally {
      setSending(false);
    }
  };

  const copyLast = async () => {
    const last = [...bubbles].reverse().find((b) => b.role === "assistant");
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content.replace(/\*\*/g, ""));
      setCopyToast(true);
      window.setTimeout(() => setCopyToast(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const renderContent = (text: string) => {
    // minimal markdown: **bold** and newlines
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-container-lowest"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={sending || phase === "pending" || phase === "tool"}
      >
        {bubbles.map((b) => {
          if (b.role === "system") {
            return (
              <div key={b.id} className="text-center text-[11px] text-on-surface-variant px-4 py-1">
                {b.content}
              </div>
            );
          }
          const isUser = b.role === "user";
          return (
            <div key={b.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? "bg-primary text-on-primary rounded-br-sm"
                    : "bg-white border border-outline-variant/20 rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {b.content.length > 900 ? (
                    <LongText text={b.content} render={renderContent} />
                  ) : (
                    renderContent(b.content)
                  )}
                </div>
                {b.actions && b.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.actions.map((a, idx) => (
                      <button
                        key={`${a.label}-${idx}`}
                        type="button"
                        onClick={() => void handleAction(a)}
                        className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 min-h-[36px] max-w-full truncate"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(phase === "pending" || phase === "tool") && (
          <div className="flex justify-start" aria-label="Đang soạn trả lời">
            <div className="bg-white border border-outline-variant/20 rounded-2xl px-3 py-2 text-[11px] text-on-surface-variant">
              <span className="inline-flex gap-1 items-center">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse delay-75">●</span>
                <span className="animate-pulse delay-150">●</span>
              </span>
              <span className="ml-2">
                {phase === "tool" ? "Đang kiểm tra lịch…" : "Đang tìm thông tin…"}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-3 py-2 text-[11px] text-error bg-error-container/20 border-t border-error-container flex justify-between gap-2">
          <span>{error}</span>
          <button type="button" className="font-bold underline" onClick={() => void regenerate()}>
            Thử lại
          </button>
        </div>
      )}

      <div className="p-2 border-t border-outline-variant/20 bg-white space-y-2 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 pb-0.5"
          role="list"
          aria-label="Gợi ý nhanh"
        >
          {QUICK_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={sending}
              onClick={() => void sendText(c)}
              className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-full border border-outline-variant/40 hover:bg-surface-container min-h-[36px] whitespace-nowrap"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end min-w-0">
          <div className="flex-1 min-w-0">
            <label className="sr-only" htmlFor="ai-concierge-input">
              Nhắn trợ lý đặt lịch
            </label>
            <textarea
              ref={inputRef}
              id="ai-concierge-input"
              rows={2}
              maxLength={MAX_LEN}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText(input);
                }
              }}
              placeholder="Ví dụ: Slot Facial ngày mai Quận 1..."
              className="w-full border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 resize-none"
              disabled={sending}
              aria-describedby="ai-concierge-disclaimer"
            />
            <div
              className={`text-[10px] text-right ${
                input.length >= MAX_LEN ? "text-error font-bold" : "text-on-surface-variant"
              }`}
            >
              {input.length}/{MAX_LEN}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void sendText(input)}
            disabled={sending || !input.trim()}
            className="bg-primary text-on-primary p-2.5 rounded-xl min-w-[44px] min-h-[44px] disabled:opacity-40 shrink-0"
            aria-label="Gửi tin nhắn"
          >
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          <button
            type="button"
            onClick={() => void regenerate()}
            className="underline text-on-surface-variant min-h-[32px]"
            disabled={sending}
          >
            Tạo lại
          </button>
          <button
            type="button"
            onClick={() => void copyLast()}
            className="underline text-on-surface-variant min-h-[32px]"
          >
            Sao chép
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
              setBubbles([
                {
                  id: `welcome-${Date.now()}`,
                  role: "assistant",
                  content: "Đã làm mới hội thoại. Bạn cần hỗ trợ gì ạ?",
                },
              ]);
              setDraft(null);
              setConfirmOpen(false);
              setError("");
            }}
            className="underline text-on-surface-variant ml-auto min-h-[32px]"
          >
            Làm mới cuộc trò chuyện
          </button>
        </div>
        {copyToast && (
          <p className="text-[10px] text-primary font-bold" role="status">
            Đã sao chép tin nhắn
          </p>
        )}
        <p id="ai-concierge-disclaimer" className="text-[9px] text-on-surface-variant leading-snug">
          Giá và slot lấy từ hệ thống. Bạn xác nhận trước khi tạo lịch hẹn.
        </p>
      </div>

      {confirmOpen && draft && (
        <div
          className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-3"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-sm shadow-xl space-y-3 max-h-[min(85dvh,520px)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-confirm-title"
          >
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-outline-variant/50 sm:hidden" aria-hidden />
            <h3 id="ai-confirm-title" className="font-bold text-sm text-primary">
              Xác nhận đặt lịch
            </h3>
            <dl className="text-xs text-on-surface-variant space-y-1.5 break-words">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-on-surface-variant/80">Dịch vụ</dt>
                <dd className="font-semibold text-on-surface text-right min-w-0">
                  {draft.serviceName || "Dịch vụ"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-on-surface-variant/80">Chi nhánh</dt>
                <dd className="font-semibold text-on-surface text-right min-w-0">
                  {draft.branchName || `CN #${draft.branchId}`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-on-surface-variant/80">Thời gian</dt>
                <dd className="font-semibold text-on-surface text-right min-w-0">
                  {new Date(draft.startTime).toLocaleString("vi-VN")}
                </dd>
              </div>
              {draft.price != null && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-on-surface-variant/80">Giá</dt>
                  <dd className="font-bold text-primary text-right">
                    {Number(draft.price).toLocaleString("vi-VN")}đ
                  </dd>
                </div>
              )}
            </dl>
            {!user && (
              <p className="text-xs text-error leading-snug">Bạn cần đăng nhập để xác nhận đặt lịch.</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="flex-1 rounded-full border py-2.5 text-xs font-bold min-h-[44px]"
                onClick={() => setConfirmOpen(false)}
              >
                Hủy
              </button>
              {user ? (
                <button
                  type="button"
                  className="flex-1 rounded-full bg-primary text-on-primary py-2.5 text-xs font-bold min-h-[44px] disabled:opacity-50"
                  disabled={sending}
                  onClick={() => void confirmBooking()}
                >
                  Xác nhận đặt
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex-1 rounded-full bg-primary text-on-primary py-2.5 text-xs font-bold min-h-[44px] text-center inline-flex items-center justify-center"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LongText({
  text,
  render,
}: {
  text: string;
  render: (t: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? text : `${text.slice(0, 700)}…`;
  return (
    <div>
      {render(shown)}
      <button type="button" className="block mt-1 font-bold text-primary text-[10px]" onClick={() => setOpen(!open)}>
        {open ? "Thu gọn" : "Xem đầy đủ"}
      </button>
    </div>
  );
}
