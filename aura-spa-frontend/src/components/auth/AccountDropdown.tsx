"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const ROLE_HOME: Record<string, string> = {
  customer: "/customer",
  staff: "/staff",
  manager: "/manager",
  admin: "/admin",
  owner: "/admin",
};

export default function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  const homeHref = ROLE_HOME[user.role] ?? "/";
  const accountHref = user.role === "customer" ? "/customer/profile" : `${homeHref}/account`;
  const homeLabel =
    user.role === "customer" ? t("Không gian của tôi", "My wellness space") : t("Tổng quan", "Overview");

  const roleLabels: Record<string, string> = {
    customer: t("Khách hàng", "Customer"),
    staff: t("Nhân viên", "Staff"),
    manager: t("Quản lý chi nhánh", "Branch Manager"),
    admin: t("Chủ sở hữu", "Owner"),
    owner: t("Chủ sở hữu", "Owner"),
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full px-1.5 pr-2 hover:bg-surface-container-low transition-colors"
        aria-label={t("Tài khoản", "Account")}
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-9 h-9 rounded-full object-cover border border-outline-variant"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs border border-outline-variant">
            {initials}
          </div>
        )}
        <span className="hidden max-w-24 truncate md:block font-label-md text-label-md text-on-surface">
          {user.name.split(" ").pop()}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 18 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-outline-variant/40 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low">
            <p className="font-label-md text-label-md text-on-surface">{user.name}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{user.email}</p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-on-primary bg-primary"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}
            >
              {roleLabels[user.role] ?? user.role}
            </span>
          </div>

          <ul className="py-2">
            <li>
              <Link
                href={homeHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors font-body-md text-body-md text-on-surface"
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                  home
                </span>
                {homeLabel}
              </Link>
            </li>
            <li>
              <Link
                href={accountHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors font-body-md text-body-md text-on-surface"
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                  manage_accounts
                </span>
                {t("Quản lý tài khoản", "Manage account")}
              </Link>
            </li>
            {user.role === "customer" && (
              <>
                <li>
                  <Link
                    href="/customer/bookings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors font-body-md text-body-md text-on-surface"
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                      calendar_month
                    </span>
                    {t("Lịch hẹn của tôi", "My bookings")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/customer/complaints"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors font-body-md text-body-md text-on-surface"
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                      forum
                    </span>
                    {t("Khiếu nại & Góp ý", "Complaints & Feedback")}
                  </Link>
                </li>
              </>
            )}
          </ul>

          <div className="border-t border-outline-variant/30 py-2">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-error-container/30 transition-colors font-body-md text-body-md text-error"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                logout
              </span>
              {t("Đăng xuất", "Log out")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
