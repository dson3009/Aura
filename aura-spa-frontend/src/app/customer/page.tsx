"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { loyaltyService, type LoyaltySummary } from "@/lib/services/loyalty.service";

const heroImage =
  "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=85";

type Localize = (vi: string, en: string) => string;

function getTimeBasedGreeting(t: Localize) {
  const hour = new Date().getHours();

  if (hour < 11) return t("Chào buổi sáng", "Good morning");
  if (hour < 14) return t("Chào buổi trưa", "Good noon");
  if (hour < 18) return t("Chào buổi chiều", "Good afternoon");
  return t("Chào buổi tối", "Good evening");
}

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN") + "đ";
}

export default function CustomerHome() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const userName = user?.name || t("Khách hàng", "Guest");
  const [greeting, setGreeting] = useState(t("Chào bạn", "Hello"));
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [redeemError, setRedeemError] = useState("");

  const quickActions = useMemo(
    () => [
      {
        title: t("Lịch hẹn của tôi", "My bookings"),
        desc: t(
          "Theo dõi lịch sắp tới, đổi lịch hoặc hủy lịch khi cần.",
          "Track upcoming appointments, reschedule or cancel when needed.",
        ),
        href: "/customer/bookings",
        icon: "calendar_month",
      },
      {
        title: t("Tiến trình liệu trình", "Treatment progress"),
        desc: t(
          "Xem số buổi đã hoàn thành và ghi chú chăm sóc sau từng lần trị liệu.",
          "Review completed sessions and aftercare notes from each visit.",
        ),
        href: "/customer/treatments",
        icon: "monitor_heart",
      },
      {
        title: t("Khám phá dịch vụ", "Explore services"),
        desc: t(
          "Chọn liệu trình phù hợp và đặt lịch tại chi nhánh gần bạn.",
          "Choose a suitable treatment and book at a nearby branch.",
        ),
        href: "/services",
        icon: "spa",
      },
      {
        title: t("Khiếu nại & Góp ý", "Complaints & Feedback"),
        desc: t(
          "Gửi phản ánh về lịch hẹn, dịch vụ hoặc trải nghiệm để quản lý xử lý.",
          "Send feedback about bookings, services or branch experiences for manager follow-up.",
        ),
        href: "/customer/complaints",
        icon: "report",
      },
    ],
    [t],
  );

  const recommendations = useMemo(
    () => [
      {
        label: t("Phổ biến nhất", "Most booked"),
        name: t("Liệu trình Collagen Tươi", "Fresh Collagen Therapy"),
        description: t(
          "Công nghệ thẩm thấu sâu giúp tái tạo độ đàn hồi, mang lại làn da căng mịn sau buổi đầu tiên.",
          "Deep infusion technology helps restore elasticity and leaves skin visibly smoother after the first session.",
        ),
        duration: t("90 phút", "90 mins"),
        price: "2.500.000đ",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuB9UX-maw1OgrmtCl2_vRzARYH3hEan7o84LngNEsUs_wrCDhZ_iS-XgXuXfe3mTAp3ysNk7YH7zReE2vZ8xM6uhKiQirfCCcoFfqDcQ78CIp3NoTnWzyrxhCSR5MbqzNQUnQsG8U29UpidSQ8m-p1PXzNnoGla4od3Fur7Jm386sZ95BNeXB95pDz1RdR__1wfSl9M2H6AT4ar8VGm31VvcNCR9g-QzVYBOaG_hNn-dEpMdEhr1a6aTsurMkagou_OIdFYgaq-VO4",
      },
      {
        label: t("Khuyên dùng", "Recommended"),
        name: t("Ngâm khoáng nóng", "Warm mineral soak"),
        description: t(
          "Làn nước khoáng giàu dưỡng chất giúp xoa dịu cơ bắp, thư giãn tinh thần và phục hồi năng lượng.",
          "Mineral-rich warm water helps soothe muscles, calm the mind and restore energy.",
        ),
        duration: t("60 phút", "60 mins"),
        price: "1.200.000đ",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBm4D6sVrmhi6b67InfuoZ3-OjmAyBjKyJOt7FKTTBkja79-R3sLJNIdsERaG98smwNuO7otEhUb2mlhdZTMjevapCMh5g7IDyQ_NfNLWBCvctI9OVg19xcMgzmjJ2oD2zxflWRsSTVedw1ehSNv5FtR8mLJQ52D8gUklgze59b_ivV8T-EnnmVQ3mF0wkQID69fFAqf9kZqDwSCYkEWiLvfrhL-NzW-OiegAXjPM_VJwTT1n2HGNhFtjH0N9vdQmu1yu6njs0nPgY",
      },
    ],
    [t],
  );

  useEffect(() => {
    setGreeting(getTimeBasedGreeting(t));
  }, [language, t]);

  useEffect(() => {
    let mounted = true;

    loyaltyService
      .getMine()
      .then((data) => {
        if (mounted) setLoyalty(data);
      })
      .catch(() => {
        if (mounted) setLoyalty(null);
      })
      .finally(() => {
        if (mounted) setLoyaltyLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const pointsBalance = loyalty?.pointsBalance ?? 0;
  const loyaltyTier = loyalty?.tier ?? "Aura Member";
  const latestPointTransaction = loyalty?.transactions?.[0];
  const redeemValueVnd = loyalty?.redeemValueVnd ?? 1000;
  const parsedRedeemPoints = Number(redeemPoints);
  const redeemValue =
    Number.isFinite(parsedRedeemPoints) && parsedRedeemPoints > 0
      ? Math.floor(parsedRedeemPoints) * redeemValueVnd
      : 0;

  const refreshLoyalty = async () => {
    const data = await loyaltyService.getMine();
    setLoyalty(data);
    return data;
  };

  const handleRedeemPoints = async () => {
    const points = Math.floor(Number(redeemPoints));
    setRedeemError("");
    setRedeemMessage("");

    if (!Number.isFinite(points) || points <= 0) {
      setRedeemError(t("Vui lòng nhập số điểm muốn đổi.", "Please enter the number of points to redeem."));
      return;
    }

    if (points > pointsBalance) {
      setRedeemError(
        t("Số điểm đổi không được vượt quá điểm hiện có.", "Redeemed points cannot exceed your current balance."),
      );
      return;
    }

    try {
      setRedeemLoading(true);
      const result = await loyaltyService.redeem(points, "Redeemed points for AuraSpa reward value");
      await refreshLoyalty();
      setRedeemPoints("");
      setRedeemMessage(
        t(
          `Đã đổi ${result.pointsRedeemed.toLocaleString("vi-VN")} điểm, giá trị ${formatVnd(result.valueVnd)}.`,
          `Redeemed ${result.pointsRedeemed.toLocaleString("en-US")} points for ${formatVnd(result.valueVnd)}.`,
        ),
      );
    } catch (error) {
      setRedeemError(
        error instanceof Error ? error.message : t("Không đổi được điểm. Vui lòng thử lại.", "Could not redeem points. Please try again."),
      );
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <main className="pt-28 pb-section-padding-desktop max-w-container-max mx-auto px-gutter">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-stretch mb-10">
          <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden relative grid lg:grid-cols-[1fr_320px] min-h-[420px]">
            <div className="p-8 md:p-12 flex flex-col justify-center relative z-10">
              <p className="font-label-md text-label-md text-secondary uppercase tracking-[0.22em] mb-5">
                {t("Không gian của bạn", "Your wellness space")}
              </p>
              <h1
                className="font-headline-lg text-primary mb-5 max-w-3xl"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 58, lineHeight: "1.05" }}
              >
                {greeting}, {userName}.
              </h1>
              <p className="text-on-surface-variant text-lg leading-8 max-w-2xl">
                {t(
                  "Hôm nay là một ngày tốt để chăm sóc cơ thể, làm dịu tâm trí và đặt lại nhịp sống của bạn.",
                  "Today is a good day to care for your body, quiet your mind and reset your rhythm.",
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link
                  href="/booking"
                  className="bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md text-center hover:opacity-90 transition-opacity"
                >
                  {t("Đặt lịch ngay", "Book now")}
                </Link>
                <Link
                  href="/customer/bookings"
                  className="border border-outline-variant text-on-surface px-6 py-3 rounded-full font-label-md text-label-md text-center hover:border-primary hover:text-primary transition-colors"
                >
                  {t("Xem lịch của tôi", "View my bookings")}
                </Link>
              </div>
            </div>

            <div className="relative min-h-[260px] lg:min-h-full">
              <Image
                src={heroImage}
                alt="AuraSpa wellness treatment room"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 320px, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-transparent lg:bg-gradient-to-r lg:from-surface-container-lowest/35 lg:via-transparent lg:to-transparent" />
            </div>
          </div>

          <aside className="rounded-2xl bg-surface-container-high border border-outline-variant/20 p-7 flex flex-col justify-between">
            <div>
              <p className="font-label-sm text-label-sm text-secondary uppercase tracking-[0.2em] mb-4">
                {t("Thành viên", "Member")} {loyaltyTier}
              </p>
              <div className="flex items-end gap-2 mb-2">
                <span className="font-headline-md text-headline-md text-on-surface">
                  {loyaltyLoading ? "..." : pointsBalance.toLocaleString(language === "en" ? "en-US" : "vi-VN")}
                </span>
                <span className="text-on-surface-variant mb-1">{t("điểm tích lũy", "points")}</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-6">
                {t(
                  `Cứ ${loyalty?.earnRateVnd?.toLocaleString("vi-VN") ?? "10.000"}đ thanh toán thành công = 1 điểm. Điểm được cập nhật tự động sau mỗi giao dịch.`,
                  `Every ${loyalty?.earnRateVnd?.toLocaleString("vi-VN") ?? "10,000"}đ successfully paid = 1 point. Points are updated automatically after each transaction.`,
                )}
              </p>
              {latestPointTransaction && (
                <div className="mt-5 rounded-xl bg-surface/70 border border-outline-variant/20 px-4 py-3">
                  <p className="font-label-sm text-label-sm text-primary">
                    {t("Giao dịch gần nhất", "Latest point activity")}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {latestPointTransaction.points > 0 ? "+" : ""}
                    {latestPointTransaction.points.toLocaleString(language === "en" ? "en-US" : "vi-VN")}{" "}
                    {t("điểm", "points")}
                    {latestPointTransaction.description ? ` - ${latestPointTransaction.description}` : ""}
                  </p>
                </div>
              )}
              <div className="mt-5 rounded-xl bg-white/80 border border-outline-variant/30 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-label-sm text-label-sm text-primary uppercase tracking-[0.16em]">
                      {t("Đổi điểm", "Redeem points")}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      1 {t("điểm", "point")} = {formatVnd(redeemValueVnd)} {t("ưu đãi", "reward value")}.
                    </p>
                  </div>
                  {redeemValue > 0 && (
                    <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                      {formatVnd(redeemValue)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    suppressHydrationWarning
                    type="number"
                    min={1}
                    max={pointsBalance}
                    value={redeemPoints}
                    onChange={(event) => {
                      setRedeemPoints(event.target.value);
                      setRedeemError("");
                      setRedeemMessage("");
                    }}
                    placeholder={t("Số điểm", "Points")}
                    className="custom-input flex-1"
                    disabled={loyaltyLoading || redeemLoading}
                  />
                  <button
                    type="button"
                    onClick={handleRedeemPoints}
                    disabled={loyaltyLoading || redeemLoading || pointsBalance <= 0}
                    className="bg-primary text-on-primary px-4 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {redeemLoading ? t("Đang đổi", "Redeeming") : t("Đổi", "Redeem")}
                  </button>
                </div>
                {redeemError && <p className="text-xs text-error mt-2">{redeemError}</p>}
                {redeemMessage && <p className="text-xs text-green-700 mt-2">{redeemMessage}</p>}
              </div>
            </div>
            <Link
              href="/customer/bookings"
              className="mt-8 w-full py-3 px-5 bg-primary text-on-primary rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              {t("Xem lịch sử điểm", "View point history")}
              <span className="material-symbols-outlined text-[18px]">redeem</span>
            </Link>
          </aside>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {quickActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl bg-white border border-outline-variant/20 p-6 min-h-[220px] flex flex-col justify-between hover:border-primary/40 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 group-hover:text-primary transition-all">
                  arrow_forward
                </span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">{item.title}</h3>
                <p className="text-on-surface-variant leading-7">{item.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        <section className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-label-sm text-label-sm text-secondary uppercase tracking-[0.2em] mb-2">
                {t("Gợi ý cá nhân", "Personal picks")}
              </p>
              <h2 className="font-headline-md text-headline-md text-primary">
                {t("Dịch vụ phù hợp cho hôm nay", "Services that fit today")}
              </h2>
            </div>
            <Link className="text-primary font-label-md text-label-md hover:underline" href="/services">
              {t("Xem tất cả dịch vụ", "View all services")}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recommendations.map((item) => (
              <Link
                key={item.name}
                href="/services"
                className="group bg-white rounded-2xl border border-outline-variant/20 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
                  <div className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[240px] overflow-hidden">
                    <Image alt={item.name} src={item.image} fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
                  </div>
                  <div className="p-6 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider mb-4">
                        {item.label}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">{item.name}</h3>
                      <p className="text-on-surface-variant leading-7 line-clamp-3">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-5 text-sm">
                      <span className="font-bold text-primary">{item.duration}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                      <span className="font-bold text-on-surface">{item.price}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-primary text-on-primary p-8 md:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 overflow-hidden">
          <div className="max-w-2xl">
            <p className="font-label-sm text-label-sm uppercase tracking-[0.2em] opacity-80 mb-4">
              {t("Trải nghiệm AuraSpa", "AuraSpa experience")}
            </p>
            <h2 className="font-display-lg text-display-lg mb-4">
              {t("Đặt một lịch hẹn thật nhẹ nhàng.", "Book with calm and confidence.")}
            </h2>
            <p className="text-on-primary/85 text-lg leading-8">
              {t(
                "Chọn dịch vụ, chi nhánh và khung giờ phù hợp. Hệ thống sẽ hỗ trợ gợi ý kỹ thuật viên còn trống cho bạn.",
                "Choose a service, branch and time slot. The system helps suggest available therapists for your visit.",
              )}
            </p>
          </div>
          <Link
            href="/booking"
            className="bg-surface text-primary px-7 py-4 rounded-full font-label-md text-label-md text-center hover:shadow-xl transition-shadow shrink-0"
          >
            {t("Bắt đầu đặt lịch", "Start booking")}
          </Link>
        </section>
      </main>
    </div>
  );
}
