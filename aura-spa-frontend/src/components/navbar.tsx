"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountDropdown from "@/components/auth/AccountDropdown";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function Navbar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDashboardRoute =
    pathname.startsWith("/staff") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/admin");

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector("nav");
      if (!nav) return;

      if (window.scrollY > 50) {
        nav.classList.add("py-2", "shadow-md");
        nav.classList.remove("py-4");
      } else {
        nav.classList.add("py-4");
        nav.classList.remove("py-2", "shadow-md");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const homeHref = "/";

  const links = [
    { href: homeHref, label: t("common.home") },
    { href: "/services", label: t("common.services") },
    { href: "/story", label: t("common.story") },
    { href: "/branches", label: t("common.branches") },
    { href: "/contact", label: t("common.contact") },
  ];

  const toggleLanguage = () => {
    setLanguage(language === "vi" ? "en" : "vi");
  };

  if (isDashboardRoute) {
    return null;
  }

  return (
    <nav className="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant shadow-sm transition-all duration-300">
      <div className="flex justify-between items-center px-gutter py-4 max-w-container-max mx-auto">
        <div className="flex items-center gap-8">
          <Link href={homeHref} className="font-headline-md text-headline-md font-medium tracking-tight text-primary">
            AuraSpa
          </Link>

          <div className="hidden md:flex gap-8 items-center">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-label-md text-label-md transition-colors ${
                  pathname === link.href
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex h-10 items-center gap-1.5 rounded-full px-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
            aria-label={t("common.language")}
            title={language === "vi" ? "Switch to English" : "Chuyen sang tieng Viet"}
          >
            <span className="material-symbols-outlined text-sm">language</span>
            <span className="min-w-5 text-left font-semibold">{language.toUpperCase()}</span>
          </button>

          {isLoading ? (
            <div className="w-24" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <AccountDropdown />
            </div>
          ) : (
            <div className="hidden sm:flex gap-3 items-center">
              <Link
                href="/login?tab=login"
                className="inline-flex h-10 items-center rounded-full px-3 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
              >
                {t("common.login")}
              </Link>
              <Link
                href="/login?tab=register"
                className="inline-flex h-10 items-center rounded-full bg-primary px-6 font-label-md text-label-md text-on-primary hover:opacity-90 active:scale-95 transition-all duration-200"
              >
                {t("common.register")}
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 text-primary hover:bg-surface-container-low transition-colors"
            aria-label={mobileOpen ? t("Đóng menu", "Close menu") : t("Mở menu", "Open menu")}
            aria-expanded={mobileOpen}
          >
            <span className="material-symbols-outlined text-[22px]">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-outline-variant/30 bg-surface/98 shadow-lg">
          <div className="px-gutter py-4 space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between rounded-xl px-4 py-3 font-label-md text-label-md transition-colors ${
                  pathname === link.href
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                <span>{link.label}</span>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            ))}

            {!isLoading && !user && (
              <div className="grid grid-cols-2 gap-3 pt-3">
                <Link
                  href="/login?tab=login"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-outline-variant px-4 font-label-md text-label-md text-primary"
                >
                  {t("common.login")}
                </Link>
                <Link
                  href="/login?tab=register"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 font-label-md text-label-md text-on-primary"
                >
                  {t("common.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
