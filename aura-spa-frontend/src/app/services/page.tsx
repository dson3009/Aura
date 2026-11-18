"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RecommendPanel from "@/components/ai/RecommendPanel";
import { spaService } from "@/lib/services/spa.service";
import type { SpaService } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

const categoryOrder = ["Massage", "Facial", "Skincare", "Body", "Nail", "Package"];
const featuredTreatmentCodes = [
  "SVC-TREATMENT-RADIANCE-001",
  "SVC-TREATMENT-NECK-SHOULDER-001",
  "SVC-TREATMENT-SERENITY-001",
  "SVC-TREATMENT-COUPLE-RETREAT-001",
];

const copy = {
  vi: {
    eyebrow: "THỰC ĐƠN DỊCH VỤ",
    title: "Nghệ thuật tận hưởng",
    desc: "Hành trình đánh thức mọi giác quan qua những liệu pháp tinh túy, được thiết kế để mang lại sự cân bằng cho thân, tâm và trí.",
    categories: "Danh mục dịch vụ",
    treatmentNav: "Liệu trình",
    treatmentEyebrow: "LIỆU TRÌNH CHUYÊN SÂU",
    treatmentTitle: "Chăm sóc theo hành trình",
    treatmentDesc:
      "Các liệu trình nhiều buổi được thiết kế cho từng nhu cầu cụ thể, có theo dõi tiến trình, nhắc lịch và ghi nhận kết quả sau mỗi buổi.",
    sessionLabel: "buổi",
    perSession: "mỗi buổi",
    treatmentProgress: "Theo dõi tiến trình sau từng buổi",
    treatmentCountLabel: "Liệu trình",
    sessionRangeLabel: "Số buổi",
    followUpLabel: "Theo dõi",
    loading: "Đang tải danh sách dịch vụ...",
    errorTitle: "Không tải được dịch vụ",
    emptyTitle: "Chưa có dịch vụ đang hoạt động",
    emptyDesc: "Hãy kiểm tra dữ liệu seed hoặc trang quản lý dịch vụ.",
    soon: "Thông tin chi tiết dịch vụ sẽ được cập nhật sớm.",
    bookNow: "Đặt ngay",
    startTreatment: "Bắt đầu liệu trình",
    defaultCategoryDesc: "Những liệu pháp chăm sóc tinh tế tại AuraSpa.",
    labels: {
      Massage: "Massage",
      Facial: "Chăm sóc da",
      Skincare: "Chăm sóc da",
      Body: "Liệu pháp toàn thân",
      Nail: "Chăm sóc móng",
      Package: "Gói Wellness",
      Other: "Khác",
    },
    headings: {
      Massage: "Liệu pháp massage",
      Facial: "Chăm sóc da mặt",
      Skincare: "Chăm sóc da mặt",
      Body: "Trị liệu toàn thân",
      Nail: "Chăm sóc móng",
      Package: "Gói chăm sóc sức khỏe",
      Other: "Dịch vụ khác",
    },
    descriptions: {
      Massage: "Giải phóng căng thẳng, phục hồi năng lượng và đưa cơ thể về trạng thái cân bằng.",
      Facial: "Làm sạch, cấp ẩm và nuôi dưỡng làn da bằng các liệu trình dịu nhẹ.",
      Skincare: "Làm sạch, cấp ẩm và nuôi dưỡng làn da bằng các liệu trình dịu nhẹ.",
      Body: "Nuôi dưỡng làn da cơ thể với nguyên liệu thuần khiết từ thiên nhiên.",
      Nail: "Chăm sóc móng nhẹ nhàng, sạch sẽ và thư giãn.",
      Package: "Hành trình thư giãn trọn vẹn được thiết kế bởi các chuyên gia AuraSpa.",
      Other: "Các dịch vụ chăm sóc bổ sung tại AuraSpa.",
    },
  },
  en: {
    eyebrow: "SERVICE MENU",
    title: "The art of indulgence",
    desc: "A sensory journey through refined treatments designed to restore balance across body, mind and spirit.",
    categories: "Service categories",
    treatmentNav: "Treatments",
    treatmentEyebrow: "CURATED TREATMENT COURSES",
    treatmentTitle: "Care designed as a journey",
    treatmentDesc:
      "Multi-session courses are designed around specific needs, with progress tracking, visit reminders and outcome notes after each session.",
    sessionLabel: "sessions",
    perSession: "per session",
    treatmentProgress: "Progress tracked after every visit",
    treatmentCountLabel: "Courses",
    sessionRangeLabel: "Sessions",
    followUpLabel: "Follow-up",
    loading: "Loading services...",
    errorTitle: "Could not load services",
    emptyTitle: "No active services yet",
    emptyDesc: "Please check seed data or the service management page.",
    soon: "Service details will be updated soon.",
    bookNow: "Book Now",
    startTreatment: "Start Course",
    defaultCategoryDesc: "Refined care treatments at AuraSpa.",
    labels: {
      Massage: "Massage",
      Facial: "Facial Care",
      Skincare: "Facial Care",
      Body: "Body Therapy",
      Nail: "Nail Care",
      Package: "Wellness Packages",
      Other: "Other",
    },
    headings: {
      Massage: "Massage Therapy",
      Facial: "Facial Care",
      Skincare: "Facial Care",
      Body: "Body Therapy",
      Nail: "Nail Care",
      Package: "Wellness Packages",
      Other: "Other Services",
    },
    descriptions: {
      Massage: "Release tension, restore energy and bring your body back to balance.",
      Facial: "Cleanse, hydrate and nourish your skin with gentle targeted rituals.",
      Skincare: "Cleanse, hydrate and nourish your skin with gentle targeted rituals.",
      Body: "Nourish your body with pure nature-inspired ingredients.",
      Nail: "Clean, gentle and relaxing nail care.",
      Package: "A complete relaxation journey designed by AuraSpa specialists.",
      Other: "Additional care services at AuraSpa.",
    },
  },
};

const fallbackImages: Record<string, string> = {
  Massage: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80",
  Facial: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
  Skincare: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
  Body: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80",
  Nail: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1200&q=80",
  Package: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80",
  Other: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
};

const curatedCategoryImages: Partial<Record<string, string>> = {
  Facial: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=85",
  Skincare: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=85",
  Massage: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=85",
};

const treatmentHeroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC3ABZQOib4ahsVNToef3M5aX7h8HSD5iv-ZgCnqWTrvpkS6aTZMkdlB8-xs-Liu42swcMJIf2yTJ1-6pZUiX3faYcvl3ZGrHZIQGJbTCB34f9Bx3C6IeFWEO_NciiKa5f7AYR1OquqoWPK94usP9aIpYDamSbgHO86rPz2mF6P-NVn-KqrusGn0ND-mEEp6wdbJoYqud9yFjRY3y136ERm9wWZviyXZXqysa6TQCVFed_tO35FLQwdJ9t4xaUoXFfovQiorIraCag";

const serviceCopyByCode: Record<string, { en: { name: string; description: string } }> = {
  "SVC-FACIAL-001": {
    en: {
      name: "Basic Facial Care",
      description: "A gentle cleansing, exfoliation and hydration ritual for a fresh, balanced complexion.",
    },
  },
  "SVC-FACIAL-002": {
    en: {
      name: "Advanced Skin Therapy",
      description: "A focused skin treatment for sensitive or oily skin, designed to calm, refine and rebalance.",
    },
  },
  "SVC-FACIAL-HYDRATION-BOOST-001": {
    en: {
      name: "Hydration Boost Express Facial",
      description: "A quick cleanse, balance and hydration treatment for dehydrated skin that needs a visible refresh.",
    },
  },
  "SVC-MASSAGE-002": {
    en: {
      name: "Classic Swedish Massage",
      description: "A soothing massage with gentle rhythmic movements and natural essential oils to ease muscle tension.",
    },
  },
  "SVC-MASSAGE-NECK-SHOULDER-001": {
    en: {
      name: "Deep Neck & Shoulder Massage",
      description: "Focused care for the neck, shoulders and upper back, ideal for office workers and screen fatigue.",
    },
  },
  "SVC-MASSAGE-FOOT-HERBAL-001": {
    en: {
      name: "Herbal Foot Massage",
      description: "A warm herbal foot soak with light pressure-point massage to restore comfort after long hours standing or walking.",
    },
  },
  "SVC-BODY-001": {
    en: {
      name: "Volcanic Hot Stone Massage",
      description: "Warm basalt stones work deeply on pressure points to support circulation and relieve accumulated fatigue.",
    },
  },
  "SVC-BODY-002": {
    en: {
      name: "Natural Mineral Mud Wrap",
      description: "A mineral-rich body wrap that helps purify the skin and leave the body feeling smooth and renewed.",
    },
  },
  "SVC-BODY-GLOW-SCRUB-001": {
    en: {
      name: "Body Glow Scrub & Nourish",
      description: "A body exfoliation and nourishing ritual for dry or uneven skin, leaving it softer and more luminous.",
    },
  },
  "SVC-NAIL-001": {
    en: {
      name: "Sea Salt Exfoliation",
      description: "A gentle sea-salt exfoliation that smooths rough texture and supports natural skin renewal.",
    },
  },
  "SVC-PACKAGE-001": {
    en: {
      name: '"Serenity Journey" Wellness Package',
      description: "A complete hot stone massage, Radiance facial, herbal tea and Aura essential oil gift experience.",
    },
  },
  "SVC-PACKAGE-002": {
    en: {
      name: '"Couples Retreat" Package',
      description: "A private double-room experience with Swedish massage and full-body exfoliation for two guests.",
    },
  },
  "SVC-SPA-001": {
    en: {
      name: "Traditional Spa Package",
      description: "A Vietnamese-inspired full-body spa package. This service is currently archived.",
    },
  },
  "SVC-TREATMENT-RADIANCE-001": {
    en: {
      name: "Radiance Skin Recovery Course",
      description:
        "A five-session course for dry, dull and dehydrated skin, focused on deep hydration, barrier recovery and a brighter finish.",
    },
  },
  "SVC-TREATMENT-NECK-SHOULDER-001": {
    en: {
      name: "Neck & Shoulder Tension Relief Course",
      description:
        "A three-session course for office workers and heavy screen users, combining targeted massage with recovery guidance.",
    },
  },
  "SVC-TREATMENT-SERENITY-001": {
    en: {
      name: "Serenity Full-Body Relaxation Course",
      description:
        "A four-session restorative course for stress, light sleep issues and energy recovery through full-body relaxation therapy.",
    },
  },
  "SVC-TREATMENT-COUPLE-RETREAT-001": {
    en: {
      name: "Couple Retreat Course",
      description:
        "A two-session premium private retreat for couples or guests who want a shared wellness experience with high comfort.",
    },
  },
};

function localizeServiceName(service: SpaService, language: "vi" | "en", tService: (text: string | null | undefined) => string): string {
  if (language === "en") {
    return serviceCopyByCode[service.code]?.en.name || tService(service.name);
  }

  return service.name;
}

function localizeServiceDescription(service: SpaService, language: "vi" | "en", tService: (text: string | null | undefined) => string): string {
  if (language === "en") {
    return serviceCopyByCode[service.code]?.en.description || tService(service.description);
  }

  return service.description || "";
}

function formatPrice(price: number | string): string {
  return `${Number(price).toLocaleString("vi-VN")}đ`;
}

function getCategoryId(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getServiceImage(service: SpaService, category: string): string {
  return curatedCategoryImages[category] || service.imageUrl || fallbackImages[category] || fallbackImages.Other;
}

function isTreatmentService(service: SpaService): boolean {
  return Boolean(service.isMultiSession || (service.totalSessions ?? 0) > 1);
}

function sortTreatmentServices(a: SpaService, b: SpaService): number {
  const indexA = featuredTreatmentCodes.indexOf(a.code);
  const indexB = featuredTreatmentCodes.indexOf(b.code);
  const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
  const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, "vi");
}

function ServiceLineItem({
  service,
  withBorder,
  fallback,
  language,
  tService,
}: {
  service: SpaService;
  withBorder: boolean;
  fallback: string;
  language: "vi" | "en";
  tService: (text: string | null | undefined) => string;
}) {
  const serviceName = localizeServiceName(service, language, tService);
  const serviceDescription = localizeServiceDescription(service, language, tService);

  return (
    <Link href={`/booking?service=${service.id}`}>
      <div className={`group py-8 ${withBorder ? "border-b border-outline-variant/20" : ""} service-card-hover px-4 -mx-4 rounded-lg cursor-pointer`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-2 mb-2">
          <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
            {serviceName}
          </h3>
          <span className="font-label-md text-label-md text-primary shrink-0">
            {formatPrice(service.defaultPrice)} / {service.defaultDurationMinutes}&apos;
          </span>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          {serviceDescription || fallback}
        </p>
      </div>
    </Link>
  );
}

function TreatmentLineItem({
  service,
  text,
  withBorder,
  language,
  tService,
}: {
  service: SpaService;
  text: typeof copy.vi | typeof copy.en;
  withBorder: boolean;
  language: "vi" | "en";
  tService: (text: string | null | undefined) => string;
}) {
  const serviceName = localizeServiceName(service, language, tService);
  const serviceDescription = localizeServiceDescription(service, language, tService);

  return (
    <Link href={`/booking?service=${service.id}`}>
      <div className={`group px-4 py-7 -mx-4 rounded-lg service-card-hover cursor-pointer ${withBorder ? "border-b border-outline-variant/20" : ""}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-sm text-label-sm uppercase tracking-[0.18em] text-primary">
                {service.totalSessions} {text.sessionLabel}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {service.defaultDurationMinutes}&apos; · {text.perSession}
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-primary group-hover:underline">
              {serviceName}
            </h3>
          </div>
          <span className="font-label-md text-label-md text-primary shrink-0">
            {formatPrice(service.defaultPrice)}
          </span>
        </div>
        <p className="mt-3 max-w-3xl font-body-md text-body-md leading-relaxed text-on-surface-variant">
          {serviceDescription}
        </p>
      </div>
    </Link>
  );
}

export default function ServicesPage() {
  const { language, tService } = useLanguage();
  const text = copy[language];
  const [services, setServices] = useState<SpaService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await spaService.getServices();
        setServices(data.filter((service) => service.status === "active"));
      } catch (err) {
        setError(err instanceof Error ? err.message : text.errorTitle);
      } finally {
        setLoading(false);
      }
    };

    void loadServices();
  }, [text.errorTitle]);

  const treatmentServices = useMemo(
    () => services.filter(isTreatmentService).sort(sortTreatmentServices),
    [services],
  );

  const groupedServices = useMemo(() => {
    const grouped = services.filter((service) => !isTreatmentService(service)).reduce<Record<string, SpaService[]>>((acc, service) => {
      const category = service.category || "Other";
      acc[category] = acc[category] || [];
      acc[category].push(service);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [services]);

  useEffect(() => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    const handleClick = function (this: HTMLAnchorElement, event: Event) {
      const targetId = this.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      window.scrollTo({ top: (target as HTMLElement).offsetTop - 150, behavior: "smooth" });
    };

    anchors.forEach((anchor) => anchor.addEventListener("click", handleClick as EventListener));
    return () => anchors.forEach((anchor) => anchor.removeEventListener("click", handleClick as EventListener));
  }, [groupedServices.length]);

  return (
    <main className="pt-24 pb-24 bg-background text-on-surface">
      <section className="max-w-container-max mx-auto px-6 py-12 md:py-20 text-center">
        <span className="font-label-md text-label-md text-primary tracking-[0.3em] uppercase block mb-4">{text.eyebrow}</span>
        <h1 className="font-display-lg text-display-lg text-primary mb-6">{text.title}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto italic leading-relaxed">{text.desc}</p>
      </section>

      <div className="sticky top-[73px] z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/10 mb-16">
        <div className="max-w-container-max mx-auto px-6 overflow-x-auto">
          <div className="flex justify-center gap-8 md:gap-16 py-4 min-w-max">
            {groupedServices.length > 0 || treatmentServices.length > 0 ? (
              <>
                {treatmentServices.length > 0 && (
                  <a
                    className="font-label-md text-label-md pb-1 text-primary border-b border-primary transition-colors"
                    href="#treatment-courses"
                  >
                    {text.treatmentNav}
                  </a>
                )}
                {groupedServices.map(([category], index) => (
                  <a
                    key={category}
                    className={`font-label-md text-label-md pb-1 transition-colors ${
                      treatmentServices.length === 0 && index === 0 ? "text-primary border-b border-primary" : "text-on-surface-variant hover:text-primary"
                    }`}
                    href={`#${getCategoryId(category)}`}
                  >
                    {text.labels[category as keyof typeof text.labels] || category}
                  </a>
                ))}
              </>
            ) : (
              <span className="font-label-md text-label-md text-on-surface-variant">{text.categories}</span>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-container-max mx-auto px-6 mb-20">
        <RecommendPanel />
      </section>

      <div className="max-w-container-max mx-auto px-6">
        {loading && (
          <div className="min-h-[260px] flex flex-col items-center justify-center gap-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">autorenew</span>
            <p className="font-body-md text-body-md">{text.loading}</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-error-container bg-error-container/40 px-6 py-5 text-error">
            <p className="font-label-md text-label-md mb-1">{text.errorTitle}</p>
            <p className="font-body-md text-body-md">{error}</p>
          </div>
        )}

        {!loading && !error && groupedServices.length === 0 && treatmentServices.length === 0 && (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-6 py-12 text-center">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-3">{text.emptyTitle}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{text.emptyDesc}</p>
          </div>
        )}

        {!loading && !error && (groupedServices.length > 0 || treatmentServices.length > 0) && (
          <div className="flex flex-col gap-32">
            {treatmentServices.length > 0 && (
              <section className="scroll-mt-40" id="treatment-courses">
                <div className="grid md:grid-cols-2 gap-16 items-start">
                  <div>
                    <span className="font-label-md text-label-md text-primary tracking-[0.28em] uppercase block mb-4">
                      {text.treatmentEyebrow}
                    </span>
                    <div className="flex items-start gap-4 mb-8">
                      <span className="material-symbols-outlined text-primary scale-125 mt-2">spa</span>
                      <div>
                        <h2 className="font-headline-lg text-headline-lg text-primary">{text.treatmentTitle}</h2>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
                          {text.treatmentDesc}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-0">
                      {treatmentServices.map((service, index) => (
                        <TreatmentLineItem
                          key={service.id}
                          service={service}
                          text={text}
                          withBorder={index < treatmentServices.length - 1}
                          language={language}
                          tService={tService}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="relative aspect-square md:aspect-[4/5] overflow-hidden rounded-sm bg-surface-container shadow-lg">
                    <img
                      alt={text.treatmentTitle}
                      className="h-full w-full object-cover grayscale-[6%] transition-transform duration-700 hover:scale-105"
                      src={treatmentHeroImage}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 rounded-sm border border-white/20 bg-white/85 p-5 backdrop-blur-sm">
                      <span className="font-label-sm text-label-sm uppercase tracking-[0.24em] text-primary">
                        {text.treatmentProgress}
                      </span>
                      <p className="mt-2 font-body-md text-body-md leading-relaxed text-on-surface">
                        {text.treatmentDesc}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {groupedServices.map(([category, items], sectionIndex) => {
              const categoryKey = category as keyof typeof text.labels;
              const heading = text.headings[categoryKey] || category;
              const description = text.descriptions[categoryKey] || text.defaultCategoryDesc;
              const imageService = items.find((service) => service.imageUrl) || items[0];
              const imageFirst = sectionIndex % 2 === 1;

              if (category === "Package" || category === "Body" || category === "Nail") {
                return (
                  <section key={category} className="scroll-mt-40" id={getCategoryId(category)}>
                    <div className="mb-12 text-center">
                      <h2 className="font-headline-lg text-headline-lg text-primary mb-4">{heading}</h2>
                      <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto">{description}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                      {items.map((service) => (
                        <Link key={service.id} href={`/booking?service=${service.id}`}>
                          <article className="bg-surface-container-low p-8 rounded-lg flex flex-col justify-between service-card-hover border border-outline-variant/10 cursor-pointer h-full min-h-[260px]">
                            <div>
                              <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
                                {localizeServiceName(service, language, tService)}
                              </h3>
                              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                                {localizeServiceDescription(service, language, tService) || text.soon}
                              </p>
                            </div>
                            <span className="font-label-md text-label-md text-primary border-t border-outline-variant/20 pt-4">
                              {formatPrice(service.defaultPrice)} / {service.defaultDurationMinutes}&apos;
                            </span>
                          </article>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              }

              return (
                <section key={category} className="scroll-mt-40" id={getCategoryId(category)}>
                  <div className="grid md:grid-cols-2 gap-16 items-start">
                    {imageFirst && (
                      <div className="bg-surface-container overflow-hidden rounded-sm aspect-square md:aspect-[4/5]">
                        <img alt={heading} className="w-full h-full object-cover grayscale-[10%] hover:scale-105 transition-transform duration-700" src={getServiceImage(imageService, category)} />
                      </div>
                    )}
                    <div className={imageFirst ? "" : "order-2 md:order-1"}>
                      <div className="flex items-center gap-4 mb-8">
                        <span className="material-symbols-outlined text-primary scale-125">spa</span>
                        <div>
                          <h2 className="font-headline-lg text-headline-lg text-primary">{heading}</h2>
                          <p className="font-body-md text-body-md text-on-surface-variant mt-2">{description}</p>
                        </div>
                      </div>
                      <div className="space-y-0">
                        {items.map((service, index) => (
                          <ServiceLineItem
                            key={service.id}
                            service={service}
                            withBorder={index < items.length - 1}
                            fallback={text.soon}
                            language={language}
                            tService={tService}
                          />
                        ))}
                      </div>
                    </div>
                    {!imageFirst && (
                      <div className="order-1 md:order-2">
                        <div className="aspect-[4/5] bg-surface-container overflow-hidden rounded-sm">
                          <img alt={heading} className="w-full h-full object-cover grayscale-[20%] hover:scale-105 transition-transform duration-700" src={getServiceImage(imageService, category)} />
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
