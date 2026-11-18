"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { spaService } from "@/lib/services/spa.service";
import { treatmentService } from "@/lib/services/treatment.service";
import type { Branch, SpaService, TreatmentCourse, TreatmentSession } from "@/lib/types";

function statusLabel(status: string) {
  if (status === "active") return "Đang thực hiện";
  if (status === "completed") return "Đã hoàn thành";
  if (status === "paused") return "Tạm dừng";
  if (status === "expired") return "Đã hết hạn";
  if (status === "cancelled") return "Đã hủy";
  return status;
}

function sessionStatusLabel(status: string) {
  if (status === "planned") return "Đã lên kế hoạch";
  if (status === "booked") return "Đã đặt lịch";
  if (status === "in_progress") return "Đang thực hiện";
  if (status === "completed") return "Hoàn thành";
  if (status === "skipped") return "Bỏ qua";
  if (status === "cancelled") return "Đã hủy";
  return status;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "Chua cap nhat";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function progressPercent(course: TreatmentCourse) {
  if (!course.totalSessions) return 0;
  return Math.round((course.usedSessions / course.totalSessions) * 100);
}

function sessionTone(session: TreatmentSession) {
  if (session.status === "completed") return "bg-primary text-on-primary border-primary";
  if (session.status === "booked" || session.status === "in_progress") return "bg-primary-fixed text-primary border-primary/30";
  if (session.status === "cancelled" || session.status === "skipped") return "bg-error-container text-error border-error/30";
  return "bg-surface-container-low text-on-surface-variant border-outline-variant/40";
}

export default function CustomerTreatmentsPage() {
  const [courses, setCourses] = useState<TreatmentCourse[]>([]);
  const [services, setServices] = useState<SpaService[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadTreatments() {
      try {
        setError(null);
        const [courseData, serviceData, branchData] = await Promise.all([
          treatmentService.getMyCourses(),
          spaService.getServices(),
          spaService.getBranches(),
        ]);

        if (ignore) return;

        setCourses(courseData);
        setServices(serviceData);
        setBranches(branchData);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không tải được tiến trình liệu trình.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadTreatments();

    return () => {
      ignore = true;
    };
  }, []);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang tải tiến trình liệu trình...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <main className="max-w-5xl mx-auto px-gutter">
        <div className="mb-10">
          <p className="font-label-md text-secondary tracking-[0.2em] uppercase mb-2">AuraSpa</p>
          <h1
            className="text-primary mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 44,
              lineHeight: "52px",
            }}
          >
            Tiến trình liệu trình
          </h1>
          <p className="text-on-surface-variant max-w-2xl">
            Theo dõi số buổi đã hoàn thành, buổi còn lại và ghi chú chăm sóc sau từng lần trị liệu.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
            {error}
          </div>
        )}

        {courses.length === 0 ? (
          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5">
              <span className="material-symbols-outlined">spa</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-primary mb-3">Chưa có liệu trình nhiều buổi</h2>
            <p className="text-on-surface-variant mb-6">
              Khi bạn mua hoặc đặt gói điều trị nhiều buổi, tiến trình sẽ hiển thị tại đây.
            </p>
            <Link href="/services">
              <button className="btn-primary">Khám phá dịch vụ</button>
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            {courses.map((course) => {
              const service = serviceMap.get(course.serviceId);
              const branch = course.branchId ? branchMap.get(course.branchId) : null;
              const percent = progressPercent(course);
              const nextSession = course.sessions.find((session) =>
                session.status === "planned" || session.status === "booked" || session.status === "in_progress"
              );
              const canBookNext = course.status === "active" && course.remainingSessions > 0 && service;
              const bookingHref = `/booking?service=${encodeURIComponent(course.serviceId)}${
                course.branchId ? `&branch=${encodeURIComponent(course.branchId)}` : ""
              }&treatmentCourse=${encodeURIComponent(course.id)}`;

              return (
                <article
                  key={course.id}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
                    <div>
                      <span className="inline-flex px-3 py-1 rounded-full bg-primary-fixed text-primary text-sm font-medium mb-3">
                        {statusLabel(course.status)}
                      </span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                        {service?.name || `Liệu trình #${course.serviceId}`}
                      </h2>
                      <p className="text-on-surface-variant">
                        {branch?.name || "Áp dụng tại hệ thống"} · Bắt đầu: {formatDate(course.startedAt)} · Hết hạn: {formatDate(course.expiresAt)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <div className="rounded-lg bg-surface-container-low border border-outline-variant/20 p-4">
                        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">
                          Tiến độ
                        </p>
                        <p className="font-headline-sm text-headline-sm text-primary">{percent}%</p>
                        <p className="text-sm text-on-surface-variant">
                          {course.usedSessions}/{course.totalSessions} buổi đã dùng
                        </p>
                      </div>
                      {nextSession && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest mb-1">
                            Buổi tiếp theo
                          </p>
                          <p className="text-sm text-on-surface">
                            Buổi {nextSession.sessionNumber}/{course.totalSessions} · {sessionStatusLabel(nextSession.status)}
                          </p>
                          {nextSession.nextRecommendedAt && (
                            <p className="mt-1 text-xs text-primary font-semibold">
                              Nen dat tu: {formatDateTime(nextSession.nextRecommendedAt)}
                            </p>
                          )}
                        </div>
                      )}
                      {canBookNext && (
                        <Link href={bookingHref} className="block">
                          <button className="btn-primary w-full">
                            Đặt buổi tiếp theo
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-surface-container-high overflow-hidden mb-6">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <div className="rounded-lg border border-outline-variant/20 p-4">
                      <p className="text-on-surface-variant text-sm">Tổng số buổi</p>
                      <p className="font-headline-sm text-headline-sm text-on-surface">{course.totalSessions}</p>
                    </div>
                    <div className="rounded-lg border border-outline-variant/20 p-4">
                      <p className="text-on-surface-variant text-sm">Đã hoàn thành</p>
                      <p className="font-headline-sm text-headline-sm text-on-surface">{course.usedSessions}</p>
                    </div>
                    <div className="rounded-lg border border-outline-variant/20 p-4">
                      <p className="text-on-surface-variant text-sm">Còn lại</p>
                      <p className="font-headline-sm text-headline-sm text-on-surface">{course.remainingSessions}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {course.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="rounded-lg border border-outline-variant/20 p-4 flex flex-col md:flex-row md:items-start gap-4"
                      >
                        <div className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 font-bold ${sessionTone(session)}`}>
                          {session.sessionNumber}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <h3 className="font-label-lg text-label-lg text-on-surface">
                              Buổi {session.sessionNumber}
                            </h3>
                            <span className="text-sm text-on-surface-variant">
                              {sessionStatusLabel(session.status)} · {formatDate(session.completedAt)}
                            </span>
                          </div>
                          <p className="text-on-surface-variant">
                            {session.progressNote || "Chưa có ghi chú tiến trình cho buổi này."}
                          </p>

                          {session.careRecommendation && (
                            <div className="mt-3 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">
                                Loi dan sau buoi
                              </p>
                              <p className="text-sm text-on-surface-variant mt-1">
                                {session.careRecommendation}
                              </p>
                            </div>
                          )}
                          {session.nextRecommendedAt && session.status !== "completed" && (
                            <p className="mt-2 text-sm text-primary">
                              Goi y dat buoi nay tu: {formatDateTime(session.nextRecommendedAt)}
                            </p>
                          )}

                          {((session.beforeImages?.length ?? 0) > 0 || (session.afterImages?.length ?? 0) > 0) && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                              {[...(session.beforeImages ?? []), ...(session.afterImages ?? [])].slice(0, 4).map((image, index) => (
                                <div key={`${session.id}-${image}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-surface-container-low">
                                  <Image src={image} alt={`Ảnh tiến trình buổi ${session.sessionNumber}`} fill className="object-cover" unoptimized />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {course.sessions.length === 0 && (
                      <p className="text-on-surface-variant italic">Liệu trình này chưa có buổi nào được tạo.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
