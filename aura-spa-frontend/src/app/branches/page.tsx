"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spaService } from "@/lib/services/spa.service";
import type { Branch } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

interface BranchView {
  id: string;
  name: string;
  city: string;
  rawCity: string;
  address: string;
  hours: string;
  phone: string;
  isOpen: boolean;
  services: string[];
  description: string;
  mapSrc: string;
  mapsUrl: string;
}

const copy = {
  vi: {
    all: "Tất cả",
    eyebrow: "HỆ THỐNG CHI NHÁNH",
    title: "AuraSpa trên khắp Việt Nam",
    desc: "Tìm chi nhánh gần bạn nhất và đặt lịch trải nghiệm dịch vụ wellness chuyên nghiệp.",
    search: "Tìm theo tên hoặc địa chỉ...",
    loading: "Đang tải chi nhánh...",
    showing: "Hiển thị",
    branches: "chi nhánh",
    inCity: "tại",
    errorTitle: "Không tải được chi nhánh",
    open: "Đang mở",
    closed: "Tạm đóng",
    viewMap: "Xem bản đồ",
    book: "Đặt lịch",
    unavailable: "Không khả dụng",
    notFound: "Không tìm thấy chi nhánh nào",
    tryOther: "Thử tìm với từ khóa khác",
    map: "Bản đồ",
    mapTitle: "Tìm đường đến AuraSpa",
    openGoogle: "Mở Google Maps",
    privacy: "Chính sách bảo mật",
    careers: "Tuyển dụng",
    press: "Báo chí",
    sustainability: "Phát triển bền vững",
    activeHours: "08:00 - 21:00, T2-CN",
    inactiveHours: "Tạm ngừng hoạt động",
    updating: "Đang cập nhật",
    serviceTags: ["Massage", "Chăm sóc da", "Wellness"],
  },
  en: {
    all: "All",
    eyebrow: "BRANCH NETWORK",
    title: "AuraSpa across Vietnam",
    desc: "Find the nearest branch and book a refined wellness experience.",
    search: "Search by name or address...",
    loading: "Loading branches...",
    showing: "Showing",
    branches: "branches",
    inCity: "in",
    errorTitle: "Could not load branches",
    open: "Open",
    closed: "Closed",
    viewMap: "View map",
    book: "Book",
    unavailable: "Unavailable",
    notFound: "No branches found",
    tryOther: "Try another keyword",
    map: "Map",
    mapTitle: "Get directions to AuraSpa",
    openGoogle: "Open Google Maps",
    privacy: "Privacy Policy",
    careers: "Careers",
    press: "Press",
    sustainability: "Sustainability",
    activeHours: "08:00 - 21:00, Mon-Sun",
    inactiveHours: "Temporarily closed",
    updating: "Updating",
    serviceTags: ["Massage", "Facial Care", "Wellness"],
  },
};

const ALL_CITIES = "__all__";

const cityLabels = {
  vi: {
    "Ho Chi Minh City": "TP. Hồ Chí Minh",
    Hanoi: "Hà Nội",
    "Da Nang": "Đà Nẵng",
  },
  en: {
    "Ho Chi Minh City": "Ho Chi Minh City",
    Hanoi: "Hanoi",
    "Da Nang": "Da Nang",
  },
};

const branchNameLabels = {
  vi: new Map<string, string>([
    ["HCM-Q1", "AuraSpa - Quận 1"],
    ["HCM-Q7", "AuraSpa - Quận 7"],
    ["HAN-HK", "AuraSpa - Hoàn Kiếm"],
    ["HCM-TD", "AuraSpa - Thủ Đức"],
    ["DAN-HC", "AuraSpa - Đà Nẵng Sông Hàn"],
    ["DAN-MK", "AuraSpa - Biển Mỹ Khê"],
    ["DAN-NHS", "AuraSpa - Ngũ Hành Sơn"],
  ]),
  en: new Map<string, string>([
    ["HCM-Q1", "AuraSpa - District 1"],
    ["HCM-Q7", "AuraSpa - District 7"],
    ["HAN-HK", "AuraSpa - Hoan Kiem"],
    ["HCM-TD", "AuraSpa - Thu Duc"],
    ["DAN-HC", "AuraSpa - Da Nang Han River"],
    ["DAN-MK", "AuraSpa - My Khe Beach"],
    ["DAN-NHS", "AuraSpa - Ngu Hanh Son"],
  ]),
};

const districtLabels = {
  vi: new Map<string, string>([
    ["Quan 1", "Quận 1"],
    ["Quan 7", "Quận 7"],
    ["Hoan Kiem", "Hoàn Kiếm"],
    ["Thu Duc", "Thủ Đức"],
    ["Hai Chau", "Hải Châu"],
    ["Son Tra", "Sơn Trà"],
    ["Ngu Hanh Son", "Ngũ Hành Sơn"],
  ]),
  en: new Map<string, string>([
    ["Quan 1", "District 1"],
    ["Quan 7", "District 7"],
    ["Hoan Kiem", "Hoan Kiem"],
    ["Thu Duc", "Thu Duc"],
    ["Hai Chau", "Hai Chau"],
    ["Son Tra", "Son Tra"],
    ["Ngu Hanh Son", "Ngu Hanh Son"],
  ]),
};

const vietnameseAddressTerms = new Map<string, string>([
  ["Nguyen Thi Thap", "Nguyễn Thị Thập"],
  ["Phuong Tan Phu", "Phường Tân Phú"],
  ["Nguyen Hue", "Nguyễn Huệ"],
  ["Phuong Ben Nghe", "Phường Bến Nghé"],
  ["Hang Bai", "Hàng Bài"],
  ["Phuong Tran Hung Dao", "Phường Trần Hưng Đạo"],
  ["Vo Van Ngan", "Võ Văn Ngân"],
  ["Phuong Binh Tho", "Phường Bình Thọ"],
  ["Bach Dang", "Bạch Đằng"],
  ["Hai Chau", "Hải Châu"],
  ["Vo Nguyen Giap", "Võ Nguyên Giáp"],
  ["Son Tra", "Sơn Trà"],
  ["Le Van Hien", "Lê Văn Hiến"],
  ["Ngu Hanh Son", "Ngũ Hành Sơn"],
  ["Da Nang", "Đà Nẵng"],
  ["Quan 1", "Quận 1"],
  ["Quan 7", "Quận 7"],
  ["Hoan Kiem", "Hoàn Kiếm"],
  ["Thu Duc", "Thủ Đức"],
]);

function normalizeBranchName(branch: Branch, language: "vi" | "en"): string {
  const code = "code" in branch ? String(branch.code ?? "") : "";
  return branchNameLabels[language].get(code) ?? branch.name.replace("Aura Spa", "AuraSpa");
}

function normalizeDistrict(branch: Branch, language: "vi" | "en"): string {
  if (!branch.district) return cityLabels[language][branch.city as keyof typeof cityLabels.vi] || branch.city;
  return districtLabels[language].get(branch.district) ?? branch.district;
}

function normalizeAddress(address: string, language: "vi" | "en"): string {
  if (language === "en") return address;

  let normalized = address;
  vietnameseAddressTerms.forEach((label, term) => {
    normalized = normalized.replaceAll(term, label);
  });
  return normalized;
}

function toCoordinate(value: number | string): number {
  return typeof value === "string" ? Number(value) : value;
}

function buildMapSrc(latitude: number, longitude: number): string {
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
}

function buildMapsUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function buildDescription(branch: Branch, language: "vi" | "en"): string {
  const place = normalizeDistrict(branch, language);
  if (language === "en") {
    if (branch.city === "Da Nang") return `A calm wellness space in ${place}, ideal for after-work relaxation or a coastal getaway.`;
    if (branch.city === "Hanoi") return "An AuraSpa branch in central Hanoi, offering refined care in a peaceful setting.";
    return `A professional AuraSpa wellness branch in ${place}.`;
  }

  if (branch.city === "Da Nang") return `Không gian wellness thanh lịch tại ${place}, thuận tiện cho lịch thư giãn sau giờ làm hoặc kỳ nghỉ biển.`;
  if (branch.city === "Hanoi") return "Chi nhánh AuraSpa tại trung tâm Hà Nội, mang đến trải nghiệm chăm sóc tinh tế và yên tĩnh.";
  return `Chi nhánh AuraSpa tại ${place}, mang đến trải nghiệm wellness chuyên nghiệp và thư giãn.`;
}

function toBranchView(branch: Branch, language: "vi" | "en"): BranchView {
  const latitude = toCoordinate(branch.latitude);
  const longitude = toCoordinate(branch.longitude);
  const isOpen = branch.status === "active";
  const text = copy[language];

  return {
    id: branch.id,
    name: normalizeBranchName(branch, language),
    city: cityLabels[language][branch.city as keyof typeof cityLabels.vi] || branch.city,
    rawCity: branch.city,
    address: normalizeAddress(branch.address, language),
    hours: isOpen ? text.activeHours : text.inactiveHours,
    phone: branch.phone || text.updating,
    isOpen,
    services: text.serviceTags,
    description: buildDescription(branch, language),
    mapSrc: buildMapSrc(latitude, longitude),
    mapsUrl: buildMapsUrl(latitude, longitude),
  };
}

export default function BranchesPage() {
  const { language } = useLanguage();
  const text = copy[language];
  const [rawBranches, setRawBranches] = useState<Branch[]>([]);
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);
  const [search, setSearch] = useState("");
  const [activeMap, setActiveMap] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const branches = useMemo(() => rawBranches.map((branch) => toBranchView(branch, language)), [language, rawBranches]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await spaService.getBranches();
        setRawBranches(data);
        setActiveMap((current) => current || data[0]?.id || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : text.errorTitle);
      } finally {
        setLoading(false);
      }
    };

    void loadBranches();
  }, [text.errorTitle]);

  const cities = useMemo(() => [ALL_CITIES, ...Array.from(new Set(rawBranches.map((branch) => branch.city)))], [rawBranches]);

  const filtered = useMemo(() => {
    return branches.filter((branch) => {
      const matchCity = selectedCity === ALL_CITIES || branch.rawCity === selectedCity;
      const keyword = search.trim().toLowerCase();
      const matchSearch =
        !keyword ||
        branch.name.toLowerCase().includes(keyword) ||
        branch.address.toLowerCase().includes(keyword);
      return matchCity && matchSearch;
    });
  }, [branches, search, selectedCity]);

  const selectedCityLabel =
    selectedCity === ALL_CITIES
      ? text.all
      : cityLabels[language][selectedCity as keyof typeof cityLabels.vi] || selectedCity;

  const currentMap = branches.find((branch) => branch.id === activeMap) || branches[0];

  return (
    <main className="min-h-screen bg-background text-on-surface pt-24 pb-section-padding-desktop">
      <section className="max-w-container-max mx-auto px-gutter py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="font-label-md text-label-md text-secondary tracking-[0.2em] uppercase mb-4">{text.eyebrow}</p>
          <h1 className="font-display-lg text-primary mb-6" style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, lineHeight: "56px" }}>
            {text.title}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{text.desc}</p>
        </div>
      </section>

      <div className="sticky top-[73px] z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
        <div className="max-w-container-max mx-auto px-gutter py-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: 18 }}>search</span>
            <input
              type="text"
              placeholder={text.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full border border-outline-variant rounded-lg pl-9 pr-4 py-2.5 bg-transparent font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
              style={{ fontSize: 14 }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {cities.map((city) => {
              const cityLabel = city === ALL_CITIES ? text.all : cityLabels[language][city as keyof typeof cityLabels.vi] || city;
              return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 rounded-full font-label-sm text-label-sm border transition-all ${selectedCity === city ? "bg-primary text-on-primary border-primary" : "border-outline-variant text-on-surface-variant hover:border-primary"}`}
              >
                {cityLabel}
              </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-gutter py-6">
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {loading ? text.loading : `${text.showing} ${filtered.length} ${text.branches}${selectedCity !== ALL_CITIES ? ` ${text.inCity} ${selectedCityLabel}` : ""}`}
        </p>
      </div>

      <section className="max-w-container-max mx-auto px-gutter">
        {error && (
          <div className="rounded-xl border border-error-container bg-error-container/40 px-6 py-5 text-error mb-8">
            <p className="font-label-md text-label-md mb-1">{text.errorTitle}</p>
            <p className="font-body-md text-body-md">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filtered.map((branch) => (
              <div key={branch.id} className={`bg-surface-container-lowest border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg ${branch.isOpen ? "border-outline-variant/30" : "border-outline-variant/20 opacity-70"}`}>
                <div className={`h-48 flex items-center justify-center relative ${branch.isOpen ? "bg-surface-container" : "bg-surface-container-high"}`}>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 48 }}>spa</span>
                  <div className="absolute top-4 left-4">
                    <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 font-label-sm text-label-sm ${branch.isOpen ? "bg-surface-container-lowest border-outline-variant/30 text-on-surface" : "bg-error-container border-error/20 text-error"}`}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: branch.isOpen ? "#2d6a4f" : "#ba1a1a", display: "inline-block" }} />
                      {branch.isOpen ? text.open : text.closed}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">{branch.city}</p>
                  <h3 className="font-headline-sm text-on-surface mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: 22 }}>{branch.name}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-5 leading-relaxed" style={{ fontSize: 14 }}>{branch.description}</p>

                  <div className="space-y-2 mb-5">
                    {[
                      { icon: "location_on", value: branch.address },
                      { icon: "schedule", value: branch.hours },
                      { icon: "call", value: branch.phone },
                    ].map((item) => (
                      <div key={item.icon} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: 16, marginTop: 2 }}>{item.icon}</span>
                        <span className="font-body-md text-body-md text-on-surface-variant" style={{ fontSize: 13 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {branch.services.map((service) => (
                      <span key={service} className="px-3 py-1 rounded-full font-label-sm text-label-sm border bg-primary-fixed/40 text-primary border-primary/20" style={{ fontSize: 11 }}>
                        {service}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setActiveMap(branch.id)} className="btn-ghost flex-1" style={{ padding: "10px 16px", fontSize: 13 }}>{text.viewMap}</button>
                    {branch.isOpen ? (
                      <Link href={`/booking?branch=${branch.id}`} className="flex-1">
                        <button className="btn-primary w-full" style={{ padding: "10px 16px", fontSize: 13 }}>{text.book} →</button>
                      </Link>
                    ) : (
                      <button disabled className="flex-1 btn-ghost opacity-40 cursor-not-allowed" style={{ padding: "10px 16px", fontSize: 13 }}>{text.unavailable}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-on-surface-variant mb-4" style={{ fontSize: 48, display: "block" }}>location_off</span>
            <p className="font-headline-sm text-on-surface-variant" style={{ fontFamily: "'Playfair Display', serif" }}>{text.notFound}</p>
            <p className="font-body-md text-on-surface-variant mt-2">{text.tryOther}</p>
          </div>
        )}
      </section>

      {currentMap && (
        <section className="max-w-container-max mx-auto px-gutter mt-20">
          <p className="font-label-md text-label-md text-secondary tracking-[0.2em] uppercase mb-2">{text.map}</p>
          <h2 className="font-headline-md text-primary mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>{text.mapTitle}</h2>
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
            <div className="flex border-b border-outline-variant/20 overflow-x-auto bg-surface-container-lowest">
              {branches.map((branch) => (
                <button key={branch.id} onClick={() => setActiveMap(branch.id)} className={`px-5 py-3 font-label-md text-label-md whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${activeMap === branch.id ? "text-primary border-primary" : "text-on-surface-variant border-transparent hover:text-primary"}`} style={{ fontSize: 13 }}>
                  {branch.name}
                </button>
              ))}
            </div>
            <div className="relative" style={{ height: 400 }}>
              <iframe key={activeMap} src={currentMap.mapSrc} width="100%" height="100%" style={{ border: 0, display: "block" }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <a href={currentMap.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary absolute bottom-4 right-4" style={{ padding: "8px 20px", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {text.openGoogle}
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span>
              </a>
            </div>
          </div>
        </section>
      )}

      <footer className="bg-surface-container-highest border-t border-outline-variant/10 mt-section-padding-desktop">
        <div className="flex flex-col md:flex-row justify-between items-center px-gutter py-16 w-full max-w-container-max mx-auto gap-8">
          <span className="font-headline-sm text-on-surface tracking-widest uppercase" style={{ fontFamily: "'Playfair Display', serif" }}>AuraSpa</span>
          <div className="flex flex-wrap justify-center gap-8">
            {[text.privacy, text.sustainability, text.careers, text.press].map((item) => (
              <a key={item} href="#" className="text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm uppercase tracking-widest">{item}</a>
            ))}
          </div>
          <p className="font-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>© 2024 AuraSpa Wellness.</p>
        </div>
      </footer>
    </main>
  );
}
