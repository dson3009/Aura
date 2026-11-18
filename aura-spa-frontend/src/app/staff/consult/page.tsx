"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { staffService } from "@/lib/services/staff.service";
import type { Conversation, ConversationMessage } from "@/lib/types";

interface Message {
  id: string;
  from: "customer" | "staff";
  text: string;
  time: string;
  isSystem?: boolean;
}

interface Inquiry {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  time: string;
  status: "waiting" | "active" | "closed";
}

function formatTime(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

export default function StaffConsult() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [toast, setToast] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadConversations = useCallback(async () => {
    try {
      const list = await staffService.getConversations();
      const mapped = (list || []).map((c) => ({
        id: c.id,
        customerName: c.guestName || "Khách hàng",
        customerEmail: c.guestEmail || "",
        subject: c.subject || "Yêu cầu tư vấn",
        message: "",
        time: formatTime(c.updatedAt),
        status: c.status === "open" ? "waiting" as const : c.status === "closed" ? "closed" as const : "active" as const,
      }));
      setInquiries(mapped);
    } catch (err) {
      console.error("Lỗi tải danh sách hội thoại:", err);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const list = await staffService.getConversationMessages(id);
      const mapped = (list || []).map((m) => ({
        id: m.id,
        from: (m.senderType === "staff" ? "staff" : "customer") as "staff" | "customer",
        text: m.message,
        time: formatTime(m.createdAt),
      }));
      setMessages(mapped);
    } catch (err) {
      console.error("Lỗi tải tin nhắn:", err);
    }
  }, []);

  // Poll conversation list
  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => {
      void loadConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Poll active conversation messages
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeId);
    const interval = setInterval(() => {
      void loadMessages(activeId);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeInquiry = inquiries.find((i) => i.id === activeId);

  const openChat = (id: string) => {
    setActiveId(id);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeId) return;
    try {
      await staffService.replyConversation(activeId, inputText.trim());
      setInputText("");
      void loadMessages(activeId);
      void loadConversations();
    } catch (err) {
      showToast("Lỗi gửi tin nhắn");
    }
  };

  const closeChat = async (id: string) => {
    try {
      await staffService.updateConversation(id, { status: "closed" });
      setInquiries((p) => p.map((i) => i.id === id ? { ...i, status: "closed" } : i));
      if (activeId === id) setActiveId(null);
      showToast("✓ Phiên tư vấn đã kết thúc và được lưu lại");
      void loadConversations();
    } catch (err) {
      showToast("Lỗi khi kết thúc hội thoại");
    }
  };

  const handleTransferToManager = async (id: string) => {
    try {
      await staffService.updateConversation(id, { assignedStaffId: "manager" });
      showToast("✓ Đã chuyển cuộc hội thoại lên Quản lý chi nhánh");
      if (activeId === id) setActiveId(null);
      void loadConversations();
    } catch (err) {
      showToast("Lỗi khi chuyển tiếp hội thoại");
    }
  };

  const insertSuggestion = (text: string) => setInputText(text);

  const SUGGESTIONS = [
    "Xin chào! Tôi có thể giúp gì cho bạn?",
    "Dịch vụ này rất được yêu thích tại AuraSpa. Bạn có muốn đặt lịch không?",
    "Chúng tôi hiện có ưu đãi 20% cho lần đặt lịch đầu tiên với mã AURA20.",
    "Bạn có thể đặt lịch trực tiếp tại website hoặc gọi 1900 8888.",
  ];

  return (
    <div className="h-full flex overflow-hidden">
      {toast && <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">{toast}</div>}

      {/* Inquiry list */}
      <aside className="w-72 bg-surface border-r border-outline-variant/30 flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-primary">Tư vấn trực tuyến</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {inquiries.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-8">Không có hội thoại nào</p>
          ) : (
            inquiries.map((inq) => (
              <div key={inq.id} onClick={() => openChat(inq.id)}
                className={`p-3 rounded-xl mb-1 cursor-pointer transition-all ${activeId === inq.id ? "bg-primary/10 border border-primary/30" : "hover:bg-surface-container"}`}>
                <div className="flex justify-between items-start mb-1">
                  <p className="font-label-md text-label-md text-on-surface font-bold text-sm truncate max-w-[150px]">{inq.customerName}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${inq.status === "waiting" ? "bg-error animate-pulse" : inq.status === "active" ? "bg-green-500" : "bg-outline"}`} />
                    <span className={`text-xs font-bold ${inq.status === "waiting" ? "text-error" : inq.status === "active" ? "text-green-600" : "text-on-surface-variant"}`}>
                      {inq.status === "waiting" ? "Chờ" : inq.status === "active" ? "Đang chat" : "Đã đóng"}
                    </span>
                  </div>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant text-xs truncate">{inq.subject}</p>
                <p className="text-xs text-outline mt-0.5">{inq.time}</p>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeInquiry ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-outline-variant/20 bg-surface flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
                  {activeInquiry.customerName.split(" ").pop()?.[0]}
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-bold">{activeInquiry.customerName}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{activeInquiry.customerEmail}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void handleTransferToManager(activeInquiry.id)} className="flex items-center gap-1 border border-outline-variant px-3 py-1.5 rounded-full text-on-surface-variant text-sm hover:bg-surface-container">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>transfer_within_a_station</span>Chuyển
                </button>
                {activeInquiry.status !== "closed" && (
                  <button onClick={() => closeChat(activeInquiry.id)} className="flex items-center gap-1 border border-error text-error px-3 py-1.5 rounded-full text-sm hover:bg-error-container/20">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>Kết thúc
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-container-lowest">
              <div className="text-center mb-4">
                <span className="bg-surface-container text-on-surface-variant text-xs px-3 py-1 rounded-full">{activeInquiry.subject}</span>
              </div>
              {messages.length === 0 ? (
                <p className="text-center text-xs text-on-surface-variant py-8">Chưa có tin nhắn nào</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.from === "staff" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${msg.from === "staff" ? "bg-primary text-on-primary rounded-br-none" : "bg-white border border-outline-variant/20 text-on-surface rounded-bl-none"}`}>
                      <p>{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.from === "staff" ? "text-on-primary/70 text-right" : "text-on-surface-variant"}`}>{msg.time}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {activeInquiry.status !== "closed" && (
              <div className="px-4 py-2 bg-surface border-t border-outline-variant/10 flex gap-2 overflow-x-auto shrink-0">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => insertSuggestion(s)}
                    className="shrink-0 text-xs bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full border border-outline-variant/30 hover:border-primary hover:text-primary transition-all">
                    {s.slice(0, 30)}...
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {activeInquiry.status !== "closed" ? (
              <div className="p-4 bg-surface border-t border-outline-variant/20 flex gap-3 shrink-0">
                <input
                  className="flex-1 border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors bg-white"
                  placeholder="Nhập tin nhắn tư vấn..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                />
                <button onClick={sendMessage} disabled={!inputText.trim()}
                  className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-md text-label-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-surface border-t border-outline-variant/20 text-center text-xs text-on-surface-variant shrink-0">
                Phiên tư vấn này đã kết thúc.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-6xl mb-4 text-outline">chat</span>
            <p className="font-headline-sm text-headline-sm text-on-surface mb-2">Tư vấn khách hàng</p>
            <p className="font-body-md text-body-md">Chọn một yêu cầu từ danh sách bên trái để bắt đầu tư vấn</p>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span>{inquiries.filter((i) => i.status === "waiting").length} yêu cầu đang chờ</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
