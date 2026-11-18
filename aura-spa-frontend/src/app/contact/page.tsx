"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conversationService } from "@/lib/services/conversation.service";
import { spaService } from "@/lib/services/spa.service";
import type { Branch, ConversationMessage } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

type FormState = "idle" | "loading" | "success" | "error";
type ChatState = "closed" | "open" | "connecting";

interface ChatMessage {
  id: string;
  from: "user" | "staff";
  text: string;
  time: string;
}

const STORAGE_KEY = "auraspa_contact_conversation_id";
const STAFF_ONLINE = true;

const fallbackBranches: Branch[] = [
  {
    id: "1",
    code: "HCM-Q1",
    name: "AuraSpa - Quận 1",
    address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1",
    city: "TP. Hồ Chí Minh",
    district: "Quận 1",
    latitude: 10.77609,
    longitude: 106.70295,
    phone: "0283001001",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "2",
    code: "HCM-Q7",
    name: "AuraSpa - Quận 7",
    address: "456 Nguyễn Thị Thập, Phường Tân Phú, Quận 7",
    city: "TP. Hồ Chí Minh",
    district: "Quận 7",
    latitude: 10.73038,
    longitude: 106.72186,
    phone: "0283001002",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "3",
    code: "HAN-HK",
    name: "AuraSpa - Hoàn Kiếm",
    address: "78 Hàng Bài, Quận Hoàn Kiếm",
    city: "Hà Nội",
    district: "Hoàn Kiếm",
    latitude: 21.02437,
    longitude: 105.84422,
    phone: "0243001001",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "5",
    code: "DAN-HC",
    name: "AuraSpa - Sông Hàn",
    address: "88 Bạch Đằng, Hải Châu, Đà Nẵng",
    city: "Đà Nẵng",
    district: "Hải Châu",
    latitude: 16.07393,
    longitude: 108.22195,
    phone: "02363001001",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "6",
    code: "DAN-MK",
    name: "AuraSpa - Biển Mỹ Khê",
    address: "12 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
    city: "Đà Nẵng",
    district: "Sơn Trà",
    latitude: 16.06778,
    longitude: 108.24608,
    phone: "02363001002",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "7",
    code: "DAN-NHS",
    name: "AuraSpa - Ngũ Hành Sơn",
    address: "25 Lê Văn Hiến, Ngũ Hành Sơn, Đà Nẵng",
    city: "Đà Nẵng",
    district: "Ngũ Hành Sơn",
    latitude: 16.01362,
    longitude: 108.25383,
    phone: "02363001003",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
];

const serviceOptions = [
  "Massage thư giãn",
  "Chăm sóc da mặt",
  "Trị liệu body",
  "Gói cặp đôi",
  "Wellness cá nhân",
  "Tư vấn liệu trình",
];

const copy = {
  vi: {
    eyebrow: "Private concierge",
    title: "Gửi yêu cầu tư vấn nhanh",
    desc: "Chia sẻ nhu cầu của bạn, AuraSpa sẽ chuyển thông tin đến đúng chi nhánh để staff tư vấn dịch vụ, thời gian và liệu trình phù hợp.",
    responseTitle: "Phản hồi",
    responseValue: "Trong ngày",
    responseDesc: "Ưu tiên xác nhận lịch, dịch vụ và gói chăm sóc phù hợp.",
    name: "Họ tên",
    phone: "Số điện thoại",
    email: "Email",
    branch: "Chi nhánh muốn tư vấn",
    service: "Dịch vụ quan tâm",
    subject: "Tiêu đề",
    note: "Ghi chú",
    namePlaceholder: "Nguyễn Văn A",
    phonePlaceholder: "0901234567",
    emailPlaceholder: "example@email.com",
    branchPlaceholder: "Chọn chi nhánh AuraSpa",
    branchLoading: "Đang tải chi nhánh...",
    subjectPlaceholder: "Tôi muốn hỏi về dịch vụ...",
    notePlaceholder: "Mô tả nhu cầu, thời gian mong muốn hoặc câu hỏi của bạn...",
    submit: "Gửi yêu cầu tư vấn",
    submitting: "Đang gửi...",
    successTitle: "Yêu cầu đã được gửi",
    successDesc: "Mã tư vấn của bạn đã được lưu trên trình duyệt này. Khi staff phản hồi, bạn có thể mở chat để xem tiếp cuộc trao đổi.",
    conversationCode: "Mã tư vấn",
    openChat: "Mở hộp thoại tư vấn",
    sendAnother: "Gửi yêu cầu khác",
    error: "Không gửi được yêu cầu. Vui lòng kiểm tra backend và thử lại.",
    contactDesk: "Contact desk",
    deskDesc: "Kênh liên hệ chính thức của AuraSpa cho tư vấn dịch vụ và hỗ trợ đặt lịch.",
    hotline: "Hotline",
    hours: "Giờ hoạt động",
    hoursValue: "08:00 - 22:00 mỗi ngày",
    branchNetwork: "Hệ thống chi nhánh",
    branchNetworkValue: "TP.HCM, Hà Nội, Đà Nẵng",
    liveChat: "Tư vấn trực tuyến",
    liveChatDesc: "Bắt đầu chat để trao đổi trực tiếp với staff. Hội thoại sẽ được chuyển đến chi nhánh bạn chọn.",
    startChat: "Bắt đầu chat",
    online: "Staff đang trực tuyến",
    connecting: "Đang kết nối...",
    welcome: "Xin chào, AuraSpa có thể hỗ trợ gì cho bạn hôm nay?",
    chatPlaceholder: "Nhập tin nhắn...",
    send: "Gửi",
    closeChat: "Đóng chat",
    loadFailed: "Không tải được tin nhắn.",
    chatFailed: "Gửi tin nhắn thất bại.",
    restoreHint: "Bạn đang có một phiên tư vấn trước đó.",
    viewConversation: "Xem lại phản hồi",
    errors: {
      name: "Vui lòng nhập họ tên.",
      phone: "Vui lòng nhập số điện thoại.",
      email: "Vui lòng nhập email hợp lệ.",
      branch: "Vui lòng chọn chi nhánh.",
      subject: "Vui lòng nhập tiêu đề.",
      note: "Ghi chú tối thiểu 10 ký tự.",
    },
  },
  en: {
    eyebrow: "Private concierge",
    title: "Send a quick consultation request",
    desc: "Tell us what you need. AuraSpa will route your request to the right branch so staff can advise on services, timing and treatment plans.",
    responseTitle: "Response",
    responseValue: "Same day",
    responseDesc: "Priority support for booking, services and suitable wellness packages.",
    name: "Full name",
    phone: "Phone number",
    email: "Email",
    branch: "Preferred branch",
    service: "Interested service",
    subject: "Subject",
    note: "Note",
    namePlaceholder: "John Nguyen",
    phonePlaceholder: "0901234567",
    emailPlaceholder: "example@email.com",
    branchPlaceholder: "Choose an AuraSpa branch",
    branchLoading: "Loading branches...",
    subjectPlaceholder: "I would like to ask about a service...",
    notePlaceholder: "Describe your needs, preferred time or question...",
    submit: "Send consultation request",
    submitting: "Sending...",
    successTitle: "Request sent",
    successDesc: "Your consultation ID has been saved in this browser. When staff replies, open chat to continue the conversation.",
    conversationCode: "Consultation ID",
    openChat: "Open consultation chat",
    sendAnother: "Send another request",
    error: "Could not send your request. Please check the backend and try again.",
    contactDesk: "Contact desk",
    deskDesc: "AuraSpa's official channel for service consultation and booking support.",
    hotline: "Hotline",
    hours: "Opening hours",
    hoursValue: "08:00 - 22:00 daily",
    branchNetwork: "Branch network",
    branchNetworkValue: "HCMC, Hanoi, Da Nang",
    liveChat: "Online consultation",
    liveChatDesc: "Start a chat to speak with staff. The conversation will be routed to your selected branch.",
    startChat: "Start chat",
    online: "Staff is online",
    connecting: "Connecting...",
    welcome: "Hello, how can AuraSpa help you today?",
    chatPlaceholder: "Type a message...",
    send: "Send",
    closeChat: "Close chat",
    loadFailed: "Could not load messages.",
    chatFailed: "Could not send message.",
    restoreHint: "You have an existing consultation thread.",
    viewConversation: "View replies",
    errors: {
      name: "Please enter your full name.",
      phone: "Please enter your phone number.",
      email: "Please enter a valid email.",
      branch: "Please choose a branch.",
      subject: "Please enter a subject.",
      note: "Note must be at least 10 characters.",
    },
  },
};

function getTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function getTimeFromDate(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function toChatMessage(message: ConversationMessage): ChatMessage {
  return {
    id: message.id,
    from: message.senderType === "staff" ? "staff" : "user",
    text: message.message,
    time: getTimeFromDate(message.createdAt),
  };
}

function getBranchAddress(branch?: Branch) {
  if (!branch) return "";
  return [branch.address, branch.district, branch.city].filter(Boolean).join(", ");
}

export default function ContactPage() {
  const { language } = useLanguage();
  const text = copy[language];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [serviceInterest, setServiceInterest] = useState(serviceOptions[0]);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [chatState, setChatState] = useState<ChatState>("closed");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId),
    [branches, branchId]
  );

  useEffect(() => {
    let ignore = false;

    const loadBranches = async () => {
      try {
        setBranchesLoading(true);
        const data = await spaService.getBranches();
        if (!ignore) {
          const activeBranches = Array.isArray(data) && data.length > 0 ? data : fallbackBranches;
          setBranches(activeBranches);
        }
      } catch {
        if (!ignore) setBranches(fallbackBranches);
      } finally {
        if (!ignore) setBranchesLoading(false);
      }
    };

    const restoreTimer = window.setTimeout(() => {
      const savedConversationId = window.localStorage.getItem(STORAGE_KEY);
      if (savedConversationId) setConversationId(savedConversationId);
    }, 0);

    void loadBranches();
    return () => {
      ignore = true;
      window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadChatMessages = useCallback(async (id: string) => {
    try {
      const data = await conversationService.getMessages(id);
      setMessages(data.map(toChatMessage));
      setChatError("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : text.loadFailed);
    }
  }, [text.loadFailed]);

  useEffect(() => {
    if (chatState !== "open" || !conversationId) return;
    const firstLoad = window.setTimeout(() => void loadChatMessages(conversationId), 0);
    const interval = window.setInterval(() => void loadChatMessages(conversationId), 4000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [chatState, conversationId, loadChatMessages]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = text.errors.name;
    if (!phone.trim()) nextErrors.phone = text.errors.phone;
    if (!email.trim() || !email.includes("@")) nextErrors.email = text.errors.email;
    if (!branchId) nextErrors.branch = text.errors.branch;
    if (!subject.trim()) nextErrors.subject = text.errors.subject;
    if (!note.trim() || note.trim().length < 10) nextErrors.note = text.errors.note;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildInitialMessage = (content: string) => {
    const branchLine = selectedBranch ? `${selectedBranch.name} - ${getBranchAddress(selectedBranch)}` : "Chưa chọn";
    return [
      `Dịch vụ quan tâm: ${serviceInterest}`,
      `Chi nhánh: ${branchLine}`,
      "",
      content,
    ].join("\n");
  };

  const rememberConversation = (id: string) => {
    setConversationId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setFormState("loading");
      const conversation = await conversationService.create({
        guestName: name.trim(),
        guestPhone: phone.trim(),
        guestEmail: email.trim(),
        branchId,
        subject: subject.trim(),
        initialMessage: buildInitialMessage(note.trim()),
      });
      rememberConversation(conversation.id);
      setFormState("success");
      await loadChatMessages(conversation.id);
    } catch {
      setFormState("error");
    }
  };

  const handleReset = () => {
    setSubject("");
    setNote("");
    setErrors({});
    setFormState("idle");
  };

  const openChat = () => {
    if (!STAFF_ONLINE) return;
    setChatState("connecting");
    setChatError("");
    window.setTimeout(() => {
      setChatState("open");
      if (conversationId) {
        void loadChatMessages(conversationId);
      } else {
        setMessages((current) =>
          current.length > 0 ? current : [{ id: "welcome", from: "staff", text: text.welcome, time: getTime() }]
        );
      }
    }, 500);
  };

  const closeChat = () => {
    setChatState("closed");
    setChatError("");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;

    const value = chatInput.trim();
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, from: "user", text: value, time: getTime() }]);
    setChatInput("");
    setIsTyping(true);
    setChatError("");

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conversation = await conversationService.create({
          guestName: name.trim() || undefined,
          guestPhone: phone.trim() || undefined,
          guestEmail: email.trim() || undefined,
          branchId: branchId || undefined,
          subject: subject.trim() || text.liveChat,
          initialMessage: buildInitialMessage(value),
        });
        activeConversationId = conversation.id;
        rememberConversation(conversation.id);
      } else {
        await conversationService.sendMessage(activeConversationId, value);
      }

      await loadChatMessages(activeConversationId);
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.id !== localId));
      setChatInput(value);
      setChatError(error instanceof Error ? error.message : text.chatFailed);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-on-surface pt-24 pb-section-padding-desktop">
      <section className="max-w-container-max mx-auto px-gutter py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-8 items-stretch">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[28px] p-8 md:p-10 shadow-[0_18px_60px_rgba(113,51,35,0.08)]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 pb-8 border-b border-outline-variant/30">
              <div>
                <p className="font-label-md text-label-md text-secondary tracking-[0.35em] uppercase mb-4">{text.eyebrow}</p>
                <h1 className="font-display-lg text-primary mb-5" style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, lineHeight: "60px" }}>
                  {text.title}
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed max-w-2xl">{text.desc}</p>
              </div>
              <div className="rounded-[28px] border border-primary/15 bg-primary/5 p-6 self-start shadow-[0_16px_50px_rgba(113,51,35,0.06)]">
                <p className="font-label-sm text-label-sm text-primary tracking-[0.3em] uppercase mb-4">{text.responseTitle}</p>
                <h2 className="font-headline-sm text-primary mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{text.responseValue}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant leading-7">{text.responseDesc}</p>
              </div>
            </div>

            {conversationId && formState !== "success" && (
              <div className="mt-7 mb-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-label-md text-label-md text-primary">{text.restoreHint}</p>
                  <p className="font-body-sm text-on-surface-variant">#{conversationId}</p>
                </div>
                <button onClick={openChat} className="btn-ghost">{text.viewConversation}</button>
              </div>
            )}

            {formState === "success" ? (
              <div className="mt-9 rounded-[24px] border border-green-700/20 bg-green-50 px-6 py-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <span className="material-symbols-outlined text-green-700 mb-3" style={{ fontSize: 40 }}>check_circle</span>
                    <h2 className="font-headline-sm text-primary mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{text.successTitle}</h2>
                    <p className="font-body-md text-on-surface-variant max-w-2xl leading-7">{text.successDesc}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 border border-green-700/20 p-5 min-w-[220px]">
                    <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-2">{text.conversationCode}</p>
                    <p className="font-headline-sm text-primary font-bold">#{conversationId}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-7">
                  <button onClick={openChat} className="btn-primary">{text.openChat}</button>
                  <button onClick={handleReset} className="btn-ghost">{text.sendAnother}</button>
                </div>
              </div>
            ) : (
              <div className="mt-9">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.name}</label>
                    <input className="custom-input w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder={text.namePlaceholder} />
                    {errors.name && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.name}</p>}
                  </div>
                  <div>
                    <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.phone}</label>
                    <input className="custom-input w-full" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={text.phonePlaceholder} />
                    {errors.phone && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.email}</label>
                    <input className="custom-input w-full" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.emailPlaceholder} />
                    {errors.email && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.email}</p>}
                  </div>
                  <div>
                    <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.branch}</label>
                    <select className="custom-input w-full" value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={branchesLoading}>
                      <option value="">{branchesLoading ? text.branchLoading : text.branchPlaceholder}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} - {branch.district || branch.city}
                        </option>
                      ))}
                    </select>
                    {errors.branch && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.branch}</p>}
                  </div>
                </div>

                <div className="mt-7">
                  <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-3">{text.service}</label>
                  <div className="flex flex-wrap gap-2">
                    {serviceOptions.map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => setServiceInterest(service)}
                        className={`rounded-full border px-4 py-2 font-label-md text-label-md transition-all ${serviceInterest === service ? "bg-primary text-on-primary border-primary shadow-sm" : "bg-white text-on-surface-variant border-outline-variant/50 hover:border-primary hover:text-primary"}`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-7">
                  <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.subject}</label>
                  <input className="custom-input w-full" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={text.subjectPlaceholder} />
                  {errors.subject && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.subject}</p>}
                </div>

                <div className="mt-7">
                  <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-2">{text.note}</label>
                  <textarea
                    className="custom-input w-full resize-none"
                    rows={6}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={text.notePlaceholder}
                    style={{ borderBottom: "1px solid #d9c1bc", paddingTop: 12, lineHeight: 1.75 }}
                  />
                  {errors.note && <p className="font-label-sm text-error mt-1" style={{ fontSize: 12 }}>{errors.note}</p>}
                </div>

                {formState === "error" && (
                  <div className="mt-6 rounded-2xl border border-error/30 bg-error-container/20 px-5 py-4 text-error">{text.error}</div>
                )}

                <button onClick={handleSubmit} disabled={formState === "loading"} className="btn-primary w-full mt-8 disabled:opacity-60 disabled:cursor-not-allowed">
                  {formState === "loading" ? text.submitting : text.submit}
                </button>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[28px] p-7 shadow-[0_18px_60px_rgba(113,51,35,0.07)]">
              <p className="font-label-md text-label-md text-secondary tracking-[0.3em] uppercase mb-5">{text.contactDesk}</p>
              <h2 className="font-headline-sm text-primary mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>AuraSpa</h2>
              <p className="font-body-md text-on-surface-variant leading-7 mb-6">{text.deskDesc}</p>
              <div className="space-y-3">
                {[
                  { label: "Email", value: "hello@auraspa.vn" },
                  { label: text.hotline, value: "1900 8888" },
                  { label: text.hours, value: text.hoursValue },
                  { label: text.branchNetwork, value: text.branchNetworkValue },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-outline-variant/35 px-4 py-3 flex items-center justify-between gap-4">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-[0.25em]">{item.label}</span>
                    <span className="font-label-md text-label-md text-on-surface text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary text-on-primary rounded-[28px] p-7 shadow-[0_18px_50px_rgba(113,51,35,0.2)]">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                <p className="font-label-md text-label-md">{text.online}</p>
              </div>
              <h3 className="font-headline-sm mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{text.liveChat}</h3>
              <p className="font-body-md leading-7 text-on-primary/80 mb-6">{text.liveChatDesc}</p>
              <button onClick={openChat} className="w-full rounded-xl bg-on-primary text-primary px-5 py-3 font-label-md text-label-md hover:opacity-90 transition-opacity">
                {text.startChat}
              </button>
            </div>

            {selectedBranch && (
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[28px] p-7">
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-[0.25em] mb-3">{selectedBranch.code}</p>
                <h3 className="font-headline-sm text-primary mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{selectedBranch.name}</h3>
                <p className="font-body-md text-on-surface-variant leading-7">{getBranchAddress(selectedBranch)}</p>
                {selectedBranch.phone && <p className="font-label-md text-on-surface mt-4">{selectedBranch.phone}</p>}
              </div>
            )}
          </aside>
        </div>
      </section>

      {chatState !== "closed" && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(360px,calc(100vw-32px))] rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/40 shadow-[0_18px_60px_rgba(30,27,24,0.22)] flex flex-col">
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">AS</div>
              <div>
                <p className="font-label-md text-label-md text-on-primary">AuraSpa Concierge</p>
                <p className="font-label-sm text-on-primary/75" style={{ fontSize: 11 }}>
                  {chatState === "connecting" ? text.connecting : text.online}
                </p>
              </div>
            </div>
            <button onClick={closeChat} aria-label={text.closeChat} className="text-on-primary/80 hover:text-on-primary p-1">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          <div className="h-[300px] overflow-y-auto px-4 py-4 space-y-3">
            {conversationId && (
              <p className="text-center font-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                {text.conversationCode} #{conversationId}
              </p>
            )}

            {chatState === "connecting" && (
              <div className="text-center text-on-surface-variant text-sm pt-10">
                <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: 28 }}>forum</span>
                {text.connecting}
              </div>
            )}

            {messages.map((item) => (
              <div key={item.id} className={`flex flex-col ${item.from === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[82%] px-3 py-2 text-sm leading-6 rounded-2xl ${item.from === "user" ? "bg-primary text-on-primary rounded-br-sm" : "bg-surface-container border border-outline-variant/25 text-on-surface rounded-bl-sm"}`}>
                  {item.text}
                </div>
                <span className="text-[10px] text-on-surface-variant mt-1 px-1">{item.time}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/25 rounded-2xl rounded-bl-sm px-4 py-3 w-fit">
                {[0, 1, 2].map((item) => (
                  <span key={item} className="w-1.5 h-1.5 rounded-full bg-on-surface-variant inline-block animate-pulse" />
                ))}
              </div>
            )}

            {chatError && <p className="text-error text-xs">{chatError}</p>}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-outline-variant/25 p-3 flex gap-2">
            <input
              type="text"
              placeholder={chatState === "connecting" ? text.connecting : text.chatPlaceholder}
              disabled={chatState === "connecting"}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void sendChat()}
              className="flex-1 bg-transparent border-0 border-b border-outline-variant px-1 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => void sendChat()}
              disabled={chatState === "connecting" || !chatInput.trim()}
              aria-label={text.send}
              className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
