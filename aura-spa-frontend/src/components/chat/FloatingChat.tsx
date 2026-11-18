"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { conversationService } from "@/lib/services/conversation.service";
import { spaService } from "@/lib/services/spa.service";
import type { Conversation, ConversationMessage, Branch } from "@/lib/types";
import { aiFlags } from "@/lib/services/ai.service";
import AiConciergePanel from "@/components/ai/AiConciergePanel";

const CHAT_CONVERSATION_KEY = "auraspa_public_chat_conv_id_v2";
const LEGACY_CHAT_CONVERSATION_KEY = "auraspa_active_conv_id";

export default function FloatingChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"ai" | "human">(aiFlags.concierge ? "ai" : "human");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  
  // Initiation form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [initialMsg, setInitialMsg] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  // Branch list state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [branchLoadError, setBranchLoadError] = useState("");

  // Unread badge count state
  const [lastSeenStaffMsgCount, setLastSeenStaffMsgCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clearStoredConversation = useCallback(() => {
    setActiveConvId(null);
    setConversation(null);
    setMessages([]);
    setLastSeenStaffMsgCount(0);
    setUnreadCount(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CHAT_CONVERSATION_KEY);
      localStorage.removeItem(LEGACY_CHAT_CONVERSATION_KEY);
    }
  }, []);

  const shouldResetConversation = (err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    return message.includes("access denied") || message.includes("not found") || message.includes("forbidden");
  };

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoadingBranches(true);
      setBranchLoadError("");
      try {
        const list = await spaService.getBranches();
        const activeBranches = Array.isArray(list)
          ? list.filter((branch) => !branch.status || branch.status === "active")
          : [];
        setBranches(activeBranches);
        if (activeBranches.length === 0) {
          setBranchLoadError("Chưa có chi nhánh đang hoạt động.");
        }
      } catch (err) {
        setBranches([]);
        setBranchLoadError("Không tải được danh sách chi nhánh.");
        console.warn("Lỗi lấy danh sách chi nhánh:", err);
      } finally {
        setIsLoadingBranches(false);
      }
    };
    void fetchBranches();
  }, []);

  // Restore conversation ID from localStorage on mount
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.removeItem(LEGACY_CHAT_CONVERSATION_KEY);
      const saved = localStorage.getItem(CHAT_CONVERSATION_KEY);
      if (saved) {
        setActiveConvId(saved);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const list = await conversationService.getMessages(id);
      setMessages(list || []);
    } catch (err) {
      if (shouldResetConversation(err)) {
        clearStoredConversation();
        return;
      }
      console.warn("Could not load chat messages.");
    }
  }, [clearStoredConversation]);

  const loadConversationDetails = useCallback(async (id: string) => {
    try {
      const details = await conversationService.getConversation(id);
      setConversation(details);
    } catch (err) {
      if (shouldResetConversation(err)) {
        clearStoredConversation();
        return;
      }
      console.warn("Could not load chat conversation.");
    }
  }, [clearStoredConversation]);

  // Poll messages every 3 seconds if active conversation exists
  useEffect(() => {
    if (!activeConvId) return;
    const firstLoad = window.setTimeout(() => void loadMessages(activeConvId), 0);
    const interval = setInterval(() => {
      void loadMessages(activeConvId);
    }, 3000);
    return () => {
      window.clearTimeout(firstLoad);
      clearInterval(interval);
    };
  }, [activeConvId, loadMessages]);

  // Poll conversation details
  useEffect(() => {
    if (!activeConvId) {
      const id = window.setTimeout(() => setConversation(null), 0);
      return () => window.clearTimeout(id);
    }
    const firstLoad = window.setTimeout(() => void loadConversationDetails(activeConvId), 0);
    const interval = setInterval(() => {
      void loadConversationDetails(activeConvId);
    }, 5000);
    return () => {
      window.clearTimeout(firstLoad);
      clearInterval(interval);
    };
  }, [activeConvId, loadConversationDetails]);

  // Track unread messages from staff
  useEffect(() => {
    const staffMessages = messages.filter((m) => m.senderType === "staff");
    const staffCount = staffMessages.length;

    const id = window.setTimeout(() => {
      if (isOpen) {
        setLastSeenStaffMsgCount(staffCount);
        setUnreadCount(0);
      } else {
        const diff = staffCount - lastSeenStaffMsgCount;
        setUnreadCount(diff > 0 ? diff : 0);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [messages, isOpen, lastSeenStaffMsgCount]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validation
    const name = user?.name || guestName.trim();
    const email = user?.email || guestEmail.trim();
    const phone = user?.phone || guestPhone.trim();
    const subj = subject.trim();
    const initMsg = initialMsg.trim();

    if (!name || !email || !subj || !initMsg || !selectedBranchId) {
      setError("Vui lòng điền đầy đủ các thông tin bắt buộc và chọn chi nhánh.");
      return;
    }

    setIsStarting(true);
    try {
      const conv = await conversationService.create({
        guestName: name,
        guestEmail: email,
        guestPhone: phone || undefined,
        subject: subj,
        initialMessage: initMsg,
        branchId: selectedBranchId,
      });

      if (conv && conv.id) {
        setActiveConvId(conv.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(CHAT_CONVERSATION_KEY, conv.id);
          localStorage.removeItem(LEGACY_CHAT_CONVERSATION_KEY);
        }
        setInitialMsg("");
        setSubject("");
        setLastSeenStaffMsgCount(0);
        setUnreadCount(0);
      }
    } catch {
      setError("Không thể khởi tạo phiên tư vấn. Vui lòng thử lại.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConvId) return;
    try {
      await conversationService.sendMessage(activeConvId, inputText.trim());
      setInputText("");
      void loadMessages(activeConvId);
    } catch (err) {
      console.warn("Lỗi gửi tin nhắn:", err);
    }
  };

  const handleStartNew = () => {
    setShowEndConfirm(false);
    clearStoredConversation();
  };

  const handleCloseConversation = () => {
    setShowEndConfirm(true);
  };

  return (
    <>
      {/* Dim page when chat is open (esp. mobile) so content under the sheet is not competing */}
      {isOpen && (
        <button
          type="button"
          aria-label="Đóng chat"
          className="fixed inset-0 z-40 bg-on-surface/25 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-0 sm:pointer-events-none"
          onClick={() => setIsOpen(false)}
        />
      )}
    <div className="fixed bottom-[4.75rem] right-3 sm:bottom-28 sm:right-8 z-50 flex flex-col items-end max-w-[100vw]">
      {/* Chat Window — mobile: tall card; desktop: fixed card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={chatMode === "ai" ? "Trợ lý đặt lịch" : "Tư vấn AuraSpa"}
          className="relative w-[min(100vw-1.25rem,24rem)] sm:w-96 h-[min(72dvh,540px)] sm:h-[520px] max-h-[calc(100dvh-8rem)] bg-white rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col mb-3 sm:mb-4 overflow-hidden animate-fade-in transition-all duration-300"
        >
          
          {/* Header */}
          <div className="bg-primary text-on-primary p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-white shrink-0" style={{ fontSize: 24 }}>
                {chatMode === "ai" ? "event_available" : "support_agent"}
              </span>
              <div className="min-w-0">
                <p className="font-label-md text-label-md font-bold truncate">
                  {chatMode === "ai" ? "Trợ lý đặt lịch" : "Tư vấn AuraSpa"}
                </p>
                <p className="text-[10px] text-white/80 font-medium tracking-wide truncate">
                  {chatMode === "ai" ? "Chi nhánh · dịch vụ · slot trống" : "Hỗ trợ trực tuyến"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeConvId && chatMode === "human" && (
                <button onClick={handleCloseConversation} title="Kết thúc chat" className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">close_fullscreen</span>
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {aiFlags.concierge && (
            <div className="flex border-b border-outline-variant/20 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setChatMode("ai")}
                className={`flex-1 py-2 text-[11px] font-bold min-h-[40px] ${
                  chatMode === "ai" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant"
                }`}
              >
                Đặt lịch
              </button>
              <button
                type="button"
                onClick={() => setChatMode("human")}
                className={`flex-1 py-2 text-[11px] font-bold min-h-[40px] ${
                  chatMode === "human" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant"
                }`}
              >
                Nhân viên
              </button>
            </div>
          )}

          {chatMode === "ai" && aiFlags.concierge ? (
            <div className="flex-1 min-h-0 relative">
              <AiConciergePanel onEscalateHuman={() => setChatMode("human")} />
            </div>
          ) : (
          <>
          {/* Body human chat */}
          <div className="flex-1 overflow-y-auto p-4 bg-surface-container-lowest flex flex-col min-h-0">
            {activeConvId ? (
              /* Chat Thread */
              <div className="space-y-3 flex-1 flex flex-col">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-on-surface-variant my-auto">Đang kết nối với tư vấn viên...</p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderType === "customer" || msg.senderType === "guest";
                    const isManager = msg.senderRole === "manager";
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${isMe ? "bg-primary text-on-primary rounded-br-none" : "bg-white border border-outline-variant/20 text-on-surface rounded-bl-none"}`}>
                          {!isMe && (
                            <p className={`text-[9px] font-bold mb-1 ${isManager ? "text-primary" : "text-on-surface-variant"}`}>
                              {isManager ? "Quản lý chi nhánh" : "Nhân viên tư vấn"}
                            </p>
                          )}
                          <p className="leading-relaxed">{msg.message}</p>
                          <p className={`text-[9px] mt-1 text-right ${isMe ? "text-on-primary/60" : "text-on-surface-variant"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* Initiation Form */
              <form onSubmit={handleStartConversation} className="space-y-3 my-auto">
                <div className="text-center mb-1">
                  <h3 className="font-label-md text-label-md text-primary font-bold">Bắt đầu tư vấn online</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Chúng tôi luôn sẵn sàng lắng nghe bạn</p>
                </div>

                {error && (
                  <div className="text-xs text-error bg-error-container/30 border border-error-container p-2 rounded-xl text-center">
                    {error}
                  </div>
                )}

                {!user && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Họ và tên của bạn *"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                    />
                    <input
                      type="email"
                      placeholder="Email liên hệ *"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                    />
                    <input
                      type="tel"
                      placeholder="Số điện thoại (tùy chọn)"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <select
                    required
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={isLoadingBranches || branches.length === 0}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="" disabled>Chọn chi nhánh hỗ trợ *</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} - {b.city}
                      </option>
                    ))}
                  </select>
                  {branchLoadError && (
                    <p className="text-[11px] text-error px-1">{branchLoadError}</p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Chủ đề bạn cần tư vấn * (VD: Liệu trình collagen)"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary bg-white"
                />

                <textarea
                  placeholder="Lời nhắn ban đầu cho spa... *"
                  required
                  rows={3}
                  value={initialMsg}
                  onChange={(e) => setInitialMsg(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white resize-none"
                />

                <button
                  type="submit"
                  disabled={isStarting}
                  className="w-full bg-primary text-on-primary font-bold py-2.5 rounded-xl text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isStarting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu tư vấn"}
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </form>
            )}
          </div>

          {/* Footer Input or Start New */}
          {activeConvId && (
            conversation?.status === "closed" ? (
              <div className="p-4 bg-white border-t border-outline-variant/20 text-center flex flex-col items-center gap-2 shrink-0">
                <p className="text-xs text-on-surface-variant font-medium">Phiên tư vấn này đã kết thúc.</p>
                <button onClick={handleStartNew} className="bg-primary text-on-primary text-xs font-bold px-4 py-2.5 rounded-xl hover:opacity-90 cursor-pointer flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">add_comment</span>
                  Bắt đầu cuộc trò chuyện mới
                </button>
              </div>
            ) : (
              <div className="p-3 bg-white border-t border-outline-variant/20 flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 border border-outline-variant rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  className="bg-primary text-on-primary p-2 rounded-xl hover:opacity-90 disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer min-w-[44px] min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            )
          )}
          </>
          )}

          {showEndConfirm && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-on-surface/35 px-5 backdrop-blur-sm">
              <div className="w-full rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Kết thúc phiên tư vấn?</h3>
                    <p className="mt-1 text-sm font-medium leading-5 text-on-surface-variant">
                      Cuộc trò chuyện hiện tại sẽ được đóng khỏi khung chat. Bạn vẫn có thể bắt đầu phiên tư vấn mới khi cần.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(false)}
                    className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
                  >
                    Tiếp tục tư vấn
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-90"
                  >
                    Kết thúc
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Đóng chat" : "Mở trợ lý đặt lịch"}
        className="bg-primary text-on-primary w-12 h-12 sm:w-14 sm:h-14 min-w-[48px] min-h-[48px] sm:min-w-[56px] sm:min-h-[56px] rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-all group duration-300 relative cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">
          {isOpen ? "close" : "chat"}
        </span>
        {/* Unread count badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-error text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg border border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
    </>
  );
}

