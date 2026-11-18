"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { aiFlags, aiService, type RecommendItem, type RecommendResponse } from "@/lib/services/ai.service";
import { useLanguage } from "@/context/LanguageContext";

const quickNeeds = {
  vi: ["Da khô, thiếu ẩm", "Căng cơ cổ vai gáy", "Stress và khó ngủ", "Muốn đi spa cùng người thân"],
  en: ["Dry, dehydrated skin", "Neck and shoulder tension", "Stress and light insomnia", "Spa day with a loved one"],
};

const copy = {
  vi: {
    eyebrow: "TƯ VẤN CÁ NHÂN",
    title: "Chia sẻ nhu cầu, AuraSpa gợi ý liệu pháp phù hợp",
    desc: "Bạn có thể mô tả tình trạng da, cảm giác cơ thể hoặc mục tiêu thư giãn. AuraSpa sẽ chọn vài dịch vụ phù hợp để bạn dễ bắt đầu hơn.",
    helper: "Gợi ý dựa trên danh mục dịch vụ, thời lượng và mức độ phù hợp với nhu cầu bạn mô tả.",
    placeholder: "Ví dụ: da khô xỉn màu, ngồi máy tính nhiều bị mỏi cổ vai, muốn thư giãn cuối tuần...",
    inputLabel: "Nhu cầu chăm sóc",
    action: "Nhận gợi ý",
    loading: "Đang chuẩn bị gợi ý",
    retry: "Thử lại",
    resultsEyebrow: "GỢI Ý TỪ AURASPA",
    results: "Lựa chọn phù hợp",
    empty: "Chưa tìm thấy dịch vụ thật sự phù hợp. Bạn thử mô tả rõ hơn về tình trạng hoặc mục tiêu chăm sóc nhé.",
    startEmpty: "Nhập nhu cầu hoặc chọn một gợi ý nhanh. Kết quả sẽ hiện ở đây như một phiếu tư vấn ngắn.",
    healthNote: "Một số dịch vụ có thể đã được lọc theo hồ sơ sức khỏe để đảm bảo an toàn.",
    disclaimer: "Gợi ý chỉ mang tính tham khảo. Chuyên viên AuraSpa sẽ tư vấn lại trước khi trị liệu.",
    book: "Đặt lịch",
    match: "Phù hợp",
    duration: "phút",
    fallbackReason: "Phù hợp với nhu cầu chăm sóc bạn mô tả.",
    error: "Không tạo được gợi ý lúc này. Vui lòng kiểm tra backend hoặc thử lại sau.",
    stepOne: "Mô tả nhu cầu",
    stepTwo: "Nhận gợi ý",
    stepThree: "Chuyên viên xác nhận khi đặt lịch",
  },
  en: {
    eyebrow: "PERSONAL CONSULTATION",
    title: "Share your need and AuraSpa will suggest a suitable care path",
    desc: "Describe your skin concern, body tension or relaxation goal. AuraSpa will shortlist suitable services so you can start with more confidence.",
    helper: "Suggestions are based on service category, duration and how closely they match your care need.",
    placeholder: "Example: dry dull skin, shoulder tension from desk work, weekend relaxation...",
    inputLabel: "Care need",
    action: "Get suggestions",
    loading: "Preparing suggestions",
    retry: "Try again",
    resultsEyebrow: "AURASPA SUGGESTS",
    results: "Suitable choices",
    empty: "No service feels truly suitable yet. Try adding more detail about your condition or care goal.",
    startEmpty: "Describe your need or choose a quick prompt. Your short consultation note will appear here.",
    healthNote: "Some services may have been filtered by your health profile for safety.",
    disclaimer: "Suggestions are for reference. AuraSpa therapists will consult again before treatment.",
    book: "Book now",
    match: "Good fit",
    duration: "min",
    fallbackReason: "Matches the care need you described.",
    error: "Could not generate suggestions right now. Please check the backend or try again later.",
    stepOne: "Describe your need",
    stepTwo: "Get suggestions",
    stepThree: "Therapist confirms before booking",
  },
};

function formatPrice(price: number) {
  return `${Number(price || 0).toLocaleString("vi-VN")}đ`;
}

function matchLabel(score: number | undefined, text: (typeof copy)["vi"]) {
  const normalized = Math.max(0, Math.min(1, Number(score ?? 0.82)));
  if (text === copy.vi) {
    if (normalized >= 0.88) return "Rất phù hợp";
    if (normalized >= 0.72) return "Phù hợp";
    return "Có thể cân nhắc";
  }
  if (normalized >= 0.88) return "Excellent fit";
  if (normalized >= 0.72) return "Good fit";
  return "Worth considering";
}

function serviceBookingHref(item: RecommendItem) {
  return item.bookingDeepLink || `/booking?serviceId=${item.serviceId}`;
}

function RecommendationRow({
  item,
  text,
  index,
}: {
  item: RecommendItem;
  text: (typeof copy)["vi"];
  index: number;
}) {
  const primaryReason = item.reasons?.find(Boolean) || text.fallbackReason;

  return (
    <article className="group rounded-[22px] border border-primary/10 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(82,45,33,0.06)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_36px_rgba(82,45,33,0.1)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="rounded-full border border-primary/10 bg-surface px-3 py-1 text-xs text-on-surface-variant">
              {item.category || "AuraSpa"}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {matchLabel(item.score, text)}
            </span>
          </div>

          <h3 className="text-xl font-semibold leading-snug text-on-surface md:text-2xl">{item.name}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">{primaryReason}</p>

          {(item.caveats?.length ?? 0) > 0 && (
            <p className="mt-3 rounded-2xl bg-[#fff8ed] px-4 py-3 text-xs leading-6 text-[#7a4a1c]">
              {item.caveats?.[0]}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-primary/10 pt-4 lg:w-44 lg:flex-col lg:items-end lg:border-t-0 lg:pt-1">
          <div className="lg:text-right">
            <p className="text-lg font-semibold text-primary">{formatPrice(item.price)}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {item.durationMinutes} {text.duration}
            </p>
          </div>
          <Link
            href={serviceBookingHref(item)}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90"
          >
            {text.book}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function RecommendPanel({ branchId }: { branchId?: string }) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "vi";
  const text = copy[lang];
  const chips = quickNeeds[lang];

  const [needText, setNeedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecommendResponse | null>(null);

  const recommendations = useMemo(() => result?.recommendations?.slice(0, 3) ?? [], [result]);

  const run = useCallback(
    async (overrideNeed?: string) => {
      const nextNeed = (overrideNeed ?? needText).trim();
      if (overrideNeed !== undefined) setNeedText(overrideNeed);

      setLoading(true);
      setError("");

      try {
        const data = await aiService.recommend({
          needText: nextNeed || undefined,
          branchId,
          locale: lang,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : text.error);
      } finally {
        setLoading(false);
      }
    },
    [branchId, lang, needText, text.error],
  );

  if (!aiFlags.recommender) return null;

  return (
    <section className="overflow-hidden rounded-[30px] border border-primary/10 bg-[#fffaf7] shadow-[0_18px_45px_rgba(82,45,33,0.08)]">
      <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
        <div className="border-b border-primary/10 bg-[#fbf3ef] px-6 py-7 md:px-8 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9d6d27]">{text.eyebrow}</p>
          <h2 className="mt-4 max-w-xl font-headline-md text-3xl font-semibold leading-tight text-primary md:text-4xl">
            {text.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-on-surface-variant">{text.desc}</p>

          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
          >
            <label className="sr-only" htmlFor="care-need-text">
              {text.inputLabel}
            </label>
            <textarea
              id="care-need-text"
              value={needText}
              onChange={(event) => setNeedText(event.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
              placeholder={text.placeholder}
              className="w-full resize-none rounded-[22px] border border-primary/10 bg-white px-5 py-4 text-sm leading-7 text-on-surface shadow-inner outline-none transition placeholder:text-on-surface-variant/50 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />

            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void run(chip)}
                  className="rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-medium text-primary transition hover:border-primary/35 hover:bg-primary/5"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-on-primary shadow-[0_10px_22px_rgba(126,55,35,0.2)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? text.loading : text.action}
              </button>
              <p className="max-w-md text-xs leading-6 text-on-surface-variant">{text.helper}</p>
            </div>
          </form>
        </div>

        <div className="bg-white/80 px-6 py-7 md:px-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9d6d27]">{text.resultsEyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold text-on-surface md:text-3xl">{text.results}</h3>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-[22px] bg-surface-container" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[22px] border border-error/25 bg-error/5 p-5 text-sm text-error">
              <p>{error}</p>
              <button type="button" onClick={() => void run()} className="mt-3 font-semibold underline underline-offset-4">
                {text.retry}
              </button>
            </div>
          )}

          {!loading && !error && recommendations.length === 0 && (
            <div className="rounded-[24px] border border-primary/10 bg-[#fffaf7] p-6">
              <p className="text-sm leading-7 text-on-surface-variant">{result ? text.empty : text.startEmpty}</p>
              <div className="mt-6 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
                {[text.stepOne, text.stepTwo, text.stepThree].map((step, index) => (
                  <div key={step} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                    <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && recommendations.length > 0 && (
            <>
              <div className="space-y-3">
                {recommendations.map((item, index) => (
                  <RecommendationRow key={`${item.serviceId}-${item.code}`} item={item} index={index} text={text} />
                ))}
              </div>

              {result?.meta?.healthFiltered && (
                <p className="mt-4 rounded-2xl bg-[#fff8ed] px-4 py-3 text-xs leading-6 text-[#7a4a1c]">
                  {text.healthNote}
                </p>
              )}

              <p className="mt-4 text-xs leading-6 text-on-surface-variant/80">
                {result?.meta?.disclaimer || text.disclaimer}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
