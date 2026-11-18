"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffService } from "@/lib/services/staff.service";
import { managerService } from "@/lib/services/manager.service";

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
  assignedStaffId: string | null;
}

interface StaffRecord {
  id?: string;
  userId?: string;
  user?: {
    id: string;
    fullName: string;
  };
}

function formatTime(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ManagerConsult() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "waiting" | "mine" | "others" | "closed">("all");
  const [branchStaff, setBranchStaff] = useState<StaffRecord[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Fetch branch staff list
  useEffect(() => {
    if (!user?.branchId) return;
    const fetchStaff = async () => {
      try {
        const list = await managerService.getStaff(user.branchId as string);
        setBranchStaff(list || []);
      } catch {
      }
    };
    void fetchStaff();
  }, [user]);

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
        assignedStaffId: c.assignedStaffId,
      }));
      setInquiries(mapped);
    } catch {
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
    } catch {
    }
  }, []);

  // Poll conversation list
  useEffect(() => {
    const timer = setTimeout(() => void loadConversations(), 0);
    const interval = setInterval(() => {
      void loadConversations();
    }, 4000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadConversations]);

  // Poll active conversation messages
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!activeId) {
      timer = setTimeout(() => setMessages([]), 0);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    timer = setTimeout(() => void loadMessages(activeId), 0);
    const interval = setInterval(() => {
      void loadMessages(activeId);
    }, 2000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
    };
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
    } catch {
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
    } catch {
      showToast("Lỗi khi kết thúc hội thoại");
    }
  };

  const claimChat = async (id: string) => {
    if (!user?.id) return;
    try {
      await staffService.updateConversation(id, { assignedStaffId: user.id });
      showToast("✓ Bạn đã tiếp nhận cuộc hội thoại này");
      void loadConversations();
    } catch {
      showToast("Lỗi khi tiếp nhận hội thoại");
    }
  };

  const handbackChat = async (id: string) => {
    try {
      await staffService.updateConversation(id, { assignedStaffId: null, status: "open" });
      showToast("✓ Đã giao lại cuộc trò chuyện về hàng chờ của nhân viên");
      void loadConversations();
      setActiveId(null);
    } catch {
      showToast("Lỗi khi giao lại hội thoại");
    }
  };

  const insertSuggestion = (text: string) => setInputText(text);

  const SUGGESTIONS = [
    "Xin chào! Tôi là quản lý chi nhánh. Tôi có thể hỗ trợ gì cho bạn?",
    "Cảm ơn phản hồi của bạn. Chúng tôi sẽ giải quyết ngay lập tức.",
    "Tôi xin lỗi về trải nghiệm này. Tôi sẽ kiểm tra lại với nhân viên phụ trách ca.",
    "Bạn có muốn tôi đổi lịch hẹn hoặc hỗ trợ giải quyết trực tiếp không?",
  ];

  // Filter logic
  const filteredInquiries = inquiries.filter((inq) => {
    if (activeTab === "all") return true;
    if (activeTab === "waiting") return inq.status === "waiting";
    if (activeTab === "mine") return inq.status === "active" && inq.assignedStaffId === user?.id;
    if (activeTab === "others") return inq.status === "active" && inq.assignedStaffId !== user?.id;
    if (activeTab === "closed") return inq.status === "closed";
    return true;
  });

  const assignedStaffName = (() => {
    if (!activeInquiry?.assignedStaffId) return null;
    if (activeInquiry.assignedStaffId === user?.id) return "Bạn";
    const found = branchStaff.find(
      (s) => s.user?.id === activeInquiry.assignedStaffId || s.userId === activeInquiry.assignedStaffId
    );
    return found?.user?.fullName || "Nhân viên khác";
  })();

  return (
    <div className="h-full flex overflow-hidden">
      {toast && <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">{toast}</div>}

      {/* Inquiry list sidebar */}
      <aside className="w-80 bg-surface border-r border-outline-variant/30 flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-primary">Tư vấn của chi nhánh</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold bg-surface-container px-2.5 py-1 rounded-md inline-block">
            Bảng điều khiển Manager
          </p>
        </div>

        {/* Filters Tabs */}
        <div className="flex border-b border-outline-variant/10 text-xs overflow-x-auto bg-surface-container-low shrink-0 scrollbar-none">
          <button onClick={() => setActiveTab("all")} className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all shrink-0 px-3 ${activeTab === "all" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            Tất cả
          </button>
          <button onClick={() => setActiveTab("waiting")} className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all shrink-0 px-3 ${activeTab === "waiting" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            Đang chờ
          </button>
          <button onClick={() => setActiveTab("mine")} className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all shrink-0 px-3 ${activeTab === "mine" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            Tôi xử lý
          </button>
          <button onClick={() => setActiveTab("others")} className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all shrink-0 px-3 ${activeTab === "others" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            Staff khác
          </button>
          <button onClick={() => setActiveTab("closed")} className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-all shrink-0 px-3 ${activeTab === "closed" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            Đã đóng
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredInquiries.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-8">Không có hội thoại nào trong mục này</p>
          ) : (
            filteredInquiries.map((inq) => {
              const isMine = inq.assignedStaffId === user?.id;
              const isOther = inq.assignedStaffId && inq.assignedStaffId !== user?.id;
              return (
                <div key={inq.id} onClick={() => openChat(inq.id)}
                  className={`p-3 rounded-xl mb-1 cursor-pointer transition-all border ${activeId === inq.id ? "bg-primary/10 border-primary/30" : "border-transparent hover:bg-surface-container"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm truncate max-w-[150px]">{inq.customerName}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${inq.status === "waiting" ? "bg-error animate-pulse" : inq.status === "active" ? "bg-green-500" : "bg-outline"}`} />
                      <span className={`text-[10px] font-bold uppercase ${inq.status === "waiting" ? "text-error" : inq.status === "active" ? "text-green-600" : "text-on-surface-variant"}`}>
                        {inq.status === "waiting" ? "Chờ" : inq.status === "active" ? "Đang chat" : "Đã đóng"}
                      </span>
                    </div>
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant text-xs truncate">{inq.subject}</p>
                  
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[10px] text-outline">{inq.time}</span>
                    {inq.status !== "closed" && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isMine ? "bg-primary-container text-on-primary-container" : isOther ? "bg-surface-container-high text-on-surface-variant" : "bg-error-container text-error"}`}>
                        {isMine ? "Của bạn" : isOther ? "Nhân viên khác" : "Chưa nhận"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
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
                  <div className="flex items-center gap-2">
                    <p className="font-label-md text-label-md text-on-surface font-bold">{activeInquiry.customerName}</p>
                    {activeInquiry.status === "closed" ? (
                      <span className="text-[10px] bg-outline/10 text-on-surface-variant border border-outline/20 px-2 py-0.5 rounded-full font-bold">
                        Đã kết thúc
                      </span>
                    ) : assignedStaffName ? (
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                        Đang phân công cho: {assignedStaffName}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-error-container text-error border border-error/20 px-2 py-0.5 rounded-full font-bold">
                        Chờ tiếp nhận
                      </span>
                    )}
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{activeInquiry.customerEmail}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                {activeInquiry.status !== "closed" && (
                  <>
                    {activeInquiry.assignedStaffId !== user?.id ? (
                      <button onClick={() => void claimChat(activeInquiry.id)} className="flex items-center gap-1 bg-primary text-on-primary px-3.5 py-1.5 rounded-full text-sm font-semibold hover:opacity-95 shadow-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>handshake</span>
                        {activeInquiry.assignedStaffId ? "Tiếp quản cuộc trò chuyện" : "Nhận trò chuyện"}
                      </button>
                    ) : (
                      <button onClick={() => void handbackChat(activeInquiry.id)} className="flex items-center gap-1 border border-outline-variant px-3.5 py-1.5 rounded-full text-sm font-semibold hover:bg-surface-container text-on-surface-variant">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>Giao lại cho Staff
                      </button>
                    )}
                    
                    <button onClick={() => closeChat(activeInquiry.id)} className="flex items-center gap-1 border border-error text-error px-3.5 py-1.5 rounded-full text-sm hover:bg-error-container/20">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>Kết thúc
                    </button>
                  </>
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
                messages.map((msg) => {
                  const isMe = msg.from === "staff";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${isMe ? "bg-primary text-on-primary rounded-br-none" : "bg-white border border-outline-variant/20 text-on-surface rounded-bl-none"}`}>
                        <p>{msg.text}</p>
                        <p className={`text-xs mt-1 ${isMe ? "text-on-primary/70 text-right" : "text-on-surface-variant"}`}>{msg.time}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {activeInquiry.status !== "closed" && (
              <div className="px-4 py-2 bg-surface border-t border-outline-variant/10 flex gap-2 overflow-x-auto shrink-0">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => insertSuggestion(s)}
                    className="shrink-0 text-xs bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full border border-outline-variant/30 hover:border-primary hover:text-primary transition-all">
                    {s.slice(0, 35)}...
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {activeInquiry.status !== "closed" ? (
              <div className="p-4 bg-surface border-t border-outline-variant/20 flex gap-3 shrink-0">
                <input
                  className="flex-1 border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors bg-white"
                  placeholder="Nhập tin nhắn phản hồi..."
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
            <div className="mt-6 flex items-center gap-2 text-sm bg-surface-container px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span>{inquiries.filter((i) => i.status === "waiting").length} yêu cầu đang chờ phản hồi</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
