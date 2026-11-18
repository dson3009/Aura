"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeroPanel from "@/components/auth/HeroPanel";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import { useLanguage } from "@/context/LanguageContext";

type Tab = "login" | "register";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const activeTab: Tab = searchParams.get("tab") === "register" ? "register" : "login";
  const formSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    formSectionRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const setActiveTab = (tab: Tab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);

    router.replace(`/login?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <main className="flex h-screen overflow-hidden pt-[72px]">
      <HeroPanel />
      <section ref={formSectionRef} className="w-full lg:w-1/2 flex flex-col items-center bg-background overflow-y-auto px-8 md:px-14">
        <div className="w-full max-w-md py-10 stagger-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex justify-center mb-8">
            <span className="text-primary tracking-wide" style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600 }}>
              AuraSpa
            </span>
          </div>
          <div className="flex border-b mb-8" style={{ borderColor: "rgba(217,193,188,0.4)" }}>
            <button className={`tab-btn ${activeTab === "login" ? "active" : ""}`} onClick={() => setActiveTab("login")}>
              {t("common.login")}
            </button>
            <button className={`tab-btn ${activeTab === "register" ? "active" : ""}`} onClick={() => setActiveTab("register")}>
              {t("common.register")}
            </button>
          </div>
          {activeTab === "login"
            ? <LoginForm onSwitchTab={(tab) => setActiveTab(tab)} />
            : <RegisterForm onSwitchTab={(tab) => setActiveTab(tab)} />
          }
        </div>
        <div className="py-6 text-center" style={{ fontSize: 12, color: "rgba(83,67,63,0.4)" }}>
          © 2024 AuraSpa. Elevated Serenity.
        </div>
      </section>
    </main>
  );
}
