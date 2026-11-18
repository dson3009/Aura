"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import FloatingChat from "./FloatingChat";

const HIDDEN_PREFIXES = ["/admin", "/manager", "/staff", "/login", "/booking", "/customer/payment"];

export default function FloatingChatMount() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const quickBookingLabel = t("Đặt lịch nhanh", "Quick booking");

  if (hidden) return null;

  return (
    <>
      <FloatingChat />
      <div className="fixed bottom-8 right-8 z-40 group">
        <Link
          href="/booking"
          aria-label={quickBookingLabel}
          title={quickBookingLabel}
          className="bg-primary text-on-primary w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border border-primary/20 hover:scale-105 transition-all duration-300"
        >
          <span className="material-symbols-outlined text-2xl">calendar_month</span>
        </Link>
        <div className="absolute bottom-full right-0 mb-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all pointer-events-none">
          <div className="bg-surface border border-outline-variant/40 rounded-lg px-4 py-2 shadow-xl whitespace-nowrap">
            <p className="font-label-sm text-label-sm text-primary">{quickBookingLabel}</p>
          </div>
        </div>
      </div>
    </>
  );
}
