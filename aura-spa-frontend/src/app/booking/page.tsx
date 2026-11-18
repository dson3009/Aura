"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { bookingService } from "@/lib/services/booking.service";
import { promotionService, type EligibleDiscountCode } from "@/lib/services/promotion.service";
import { spaService } from "@/lib/services/spa.service";
import type { Branch, BranchTechnician, SpaService, TimeSlot } from "@/lib/types";

interface BookingBranch {
  id: string;
  name: string;
  address: string;
  hours: string;
  phone: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  isNearest: boolean;
}

interface BookingService {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string;
}

interface BookingTherapist {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  avatar: string;
}
interface CustomerLocation {
  latitude: number;
  longitude: number;
}

const branchTextOverrides: Record<string, Pick<Partial<BookingBranch>, "name" | "address">> = {
  "DAN-HC": {
    name: "AuraSpa Đà Nẵng - Sông Hàn",
    address: "88 Bạch Đằng, Hải Châu, Đà Nẵng",
  },
  "DAN-MK": {
    name: "AuraSpa Đà Nẵng - Mỹ Khê",
    address: "12 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
  },
  "DAN-NHS": {
    name: "AuraSpa Đà Nẵng - Ngũ Hành Sơn",
    address: "25 Lê Văn Hiến, Ngũ Hành Sơn, Đà Nẵng",
  },
};

const STEPS = ["Chi nhánh", "Dịch vụ", "Kỹ thuật viên", "Ngày & Giờ", "Xác nhận"];
const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DAY_NAMES_FULL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function fmtPrice(price: number) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

function getDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
}

function toCoordinate(value: number | string) {
  const coordinate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
}

function toNumber(value: number | string) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getDistanceKm(from: CustomerLocation, to: CustomerLocation) {
  const earthRadiusKm = 6371;
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildStartTime(date: Date, time: string) {
  return `${formatDateForApi(date)}T${time}:00+07:00`;
}

function isFutureStartTime(date: Date, time: string) {
  return new Date(buildStartTime(date, time)).getTime() > Date.now();
}

function toBookingService(service: SpaService): BookingService {
  return {
    id: service.id,
    name: service.name,
    duration: service.defaultDurationMinutes,
    price: toNumber(service.defaultPrice),
    category: service.category || "Dịch vụ",
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toBookingTherapist(assignment: BranchTechnician): BookingTherapist {
  return {
    id: assignment.user.id,
    name: assignment.user.fullName,
    specialty: "Ky thuat vien AuraSpa",
    experience: assignment.staffCode || "Dang hoat dong",
    avatar: getInitials(assignment.user.fullName) || "KT",
  };
}

function estimateDiscountAmount(code: EligibleDiscountCode, subtotal: number) {
  const minOrder = toNumber(code.minOrderAmount ?? 0);
  if (subtotal < minOrder) return 0;

  const value = toNumber(code.discountValue);
  if (code.discountType === "fixed_amount") return Math.min(value, subtotal);

  const maxDiscount = toNumber(code.maxDiscountAmount ?? 0);
  const amount = (subtotal * value) / 100;
  return maxDiscount > 0 ? Math.min(amount, maxDiscount) : amount;
}

function toBookingBranch(branch: Branch, customerLocation: CustomerLocation | null, nearestBranchId: string | null): BookingBranch {
  const latitude = toCoordinate(branch.latitude);
  const longitude = toCoordinate(branch.longitude);
  const override = branchTextOverrides[branch.code] || {};
  const distanceKm = customerLocation ? getDistanceKm(customerLocation, { latitude, longitude }) : null;

  return {
    id: branch.id,
    name: override.name || branch.name.replace("Aura Spa", "AuraSpa"),
    address: override.address || branch.address,
    hours: "08:00 - 21:00",
    phone: branch.phone || "Đang cập nhật",
    latitude,
    longitude,
    distanceKm,
    isNearest: nearestBranchId === branch.id,
  };
}

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const supportsGeolocation = typeof navigator !== "undefined" && "geolocation" in navigator;

  const [step, setStep] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(() => searchParams.get("branch"));
  const [serviceId, setServiceId] = useState<string | null>(() => searchParams.get("service"));
  const treatmentCourseId = searchParams.get("treatmentCourse");
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [therapists, setTherapists] = useState<BookingTherapist[]>([]);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);
  const [therapistError, setTherapistError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [eligibleDiscountCodes, setEligibleDiscountCodes] = useState<EligibleDiscountCode[]>([]);
  const [discountLoadError, setDiscountLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rawBranches, setRawBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState(() =>
    supportsGeolocation
      ? "Đang đề xuất chi nhánh gần bạn nhất..."
      : "Trình duyệt không hỗ trợ lấy vị trí. Bạn có thể chọn chi nhánh thủ công."
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loginRedirectUrl = useMemo(() => {
    const query = searchParams.toString();
    const target = `/booking${query ? `?${query}` : ""}`;
    return `/login?redirect=${encodeURIComponent(target)}`;
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(loginRedirectUrl);
    }
  }, [isAuthLoading, loginRedirectUrl, router, user]);

  useEffect(() => {
    let ignore = false;

    async function loadBookingData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const [branchData, serviceData] = await Promise.all([
          spaService.getBranches(),
          spaService.getServices(),
        ]);

        if (ignore) return;

        setRawBranches(branchData.filter((branch) => branch.status === "active"));
        const mappedServices = serviceData
          .filter((service) => service.status === "active")
          .map(toBookingService);
        setServices(mappedServices);
        setActiveCategory((current) => current || mappedServices[0]?.category || "");
      } catch (error) {
        console.error(error);
        if (!ignore) setLoadError("Không tải được dữ liệu đặt lịch. Kiểm tra backend rồi thử lại.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadBookingData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!supportsGeolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("Đã tìm thấy vị trí của bạn và đề xuất chi nhánh gần nhất.");
      },
      () => {
        setLocationStatus("Bạn chưa cấp quyền vị trí. Hệ thống vẫn cho phép chọn chi nhánh thủ công.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [supportsGeolocation]);

  const nearestBranchId = useMemo(() => {
    if (!customerLocation || rawBranches.length === 0) return null;

    return rawBranches.reduce<{ id: string; distance: number } | null>((nearest, branch) => {
      const distance = getDistanceKm(customerLocation, {
        latitude: toCoordinate(branch.latitude),
        longitude: toCoordinate(branch.longitude),
      });

      if (!nearest || distance < nearest.distance) return { id: branch.id, distance };
      return nearest;
    }, null)?.id || null;
  }, [customerLocation, rawBranches]);

  const branches = useMemo(
    () =>
      rawBranches
        .map((branch) => toBookingBranch(branch, customerLocation, nearestBranchId))
        .sort((a, b) => {
          if (a.isNearest) return -1;
          if (b.isNearest) return 1;
          if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
          return a.name.localeCompare(b.name, "vi");
        }),
    [customerLocation, nearestBranchId, rawBranches]
  );

  const selectedBranchId = branchId || nearestBranchId;

  useEffect(() => {
    let ignore = false;

    async function loadEligibleDiscountCodes() {
      if (!user || !selectedBranchId) {
        setEligibleDiscountCodes([]);
        setDiscountLoadError(null);
        return;
      }

      try {
        setDiscountLoadError(null);
        const codes = await promotionService.getEligibleCodes(selectedBranchId);
        if (!ignore) setEligibleDiscountCodes(codes);
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setEligibleDiscountCodes([]);
          setDiscountLoadError("Chưa tải được mã ưu đãi dành cho bạn.");
        }
      }
    }

    void loadEligibleDiscountCodes();

    return () => {
      ignore = true;
    };
  }, [selectedBranchId, user]);

  useEffect(() => {
    let ignore = false;

    async function loadAvailableSlots() {
      if (!selectedBranchId || !serviceId || !selectedDate) {
        setAvailableSlots([]);
        setSlotError(null);
        return;
      }

      try {
        setIsLoadingSlots(true);
        setSlotError(null);
        const selectedTechnicianId = therapistId && therapistId !== "auto" ? therapistId : undefined;
        const result = await bookingService.getAvailability(
          selectedBranchId,
          serviceId,
          formatDateForApi(selectedDate),
          selectedTechnicianId
        );

        if (ignore) return;

        const slots = result.slots.map((slot) => ({
          ...slot,
          available: slot.available && isFutureStartTime(selectedDate, slot.startTime),
        }));

        setAvailableSlots(slots);
        setSelectedTime((current) =>
          current && slots.some((slot) => slot.startTime === current && slot.available) ? current : null
        );
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setAvailableSlots([]);
          setSlotError("Không tải được giờ trống cho ngày này.");
        }
      } finally {
        if (!ignore) setIsLoadingSlots(false);
      }
    }

    loadAvailableSlots();

    return () => {
      ignore = true;
    };
  }, [selectedBranchId, selectedDate, serviceId, therapistId]);

  useEffect(() => {
    let ignore = false;

    async function loadTherapists() {
      if (!selectedBranchId) {
        setTherapists([]);
        setTherapistId(null);
        setTherapistError(null);
        return;
      }

      try {
        setIsLoadingTherapists(true);
        setTherapistError(null);
        setTherapistId(null);
        const data = await spaService.getBranchTechnicians(selectedBranchId);

        if (ignore) return;

        setTherapists(data.map(toBookingTherapist));
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setTherapists([]);
          setTherapistError("Không tải được danh sách kỹ thuật viên của chi nhánh này.");
        }
      } finally {
        if (!ignore) setIsLoadingTherapists(false);
      }
    }

    loadTherapists();

    return () => {
      ignore = true;
    };
  }, [selectedBranchId]);

  const canNext = () => {
    if (step === 0) return selectedBranchId !== null;
    if (step === 1) return serviceId !== null;
    if (step === 2) return therapistId !== null;
    if (step === 3) return selectedDate !== null && selectedTime !== null;
    return true;
  };

  const branch = branches.find((item) => item.id === selectedBranchId);
  const service = services.find((item) => item.id === serviceId);
  const therapist = therapistId === "auto" ? null : therapists.find((item) => item.id === therapistId);
  const categories = useMemo(() => [...new Set(services.map((item) => item.category))], [services]);
  const filteredServices = services.filter((item) => item.category === activeCategory);
  const days = useMemo(() => getDays(10), []);
  const normalizedDiscountCode = discountCode.trim().toUpperCase();
  const selectedDiscount = eligibleDiscountCodes.find((item) => item.code.toUpperCase() === normalizedDiscountCode);
  const estimatedDiscount = service && selectedDiscount ? estimateDiscountAmount(selectedDiscount, service.price) : 0;
  const estimatedTotal = service ? Math.max(0, service.price - estimatedDiscount) : 0;

  const handleConfirmBooking = async () => {
    if (!branch || !service || !selectedDate || !selectedTime) return;

    if (!user) {
      router.push(loginRedirectUrl);
      return;
    }

    if (!isFutureStartTime(selectedDate, selectedTime)) {
      setSubmitError("Khung giờ này đã qua. Vui lòng chọn một giờ khả dụng khác.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const createdBooking = await bookingService.create({
        branchId: branch.id,
        serviceId: service.id,
        startTime: buildStartTime(selectedDate, selectedTime),
        ...(therapistId && therapistId !== "auto" ? { technicianId: therapistId } : {}),
        ...(normalizedDiscountCode ? { discountCode: normalizedDiscountCode } : {}),
        ...(treatmentCourseId ? { treatmentCourseId } : {}),
      });

      // Booking created — redirect to payment regardless of discount result.
      // If applyDiscount fails, user still reaches payment page and can complete payment.
      // This prevents orphaned pending_payment bookings from duplicate submissions.
      router.push(`/customer/payment/${createdBooking.id}`);
      return;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const message =
        rawMessage && rawMessage !== "Internal server error"
          ? rawMessage
          : "Không đặt được lịch cho kỹ thuật viên hoặc khung giờ này. Vui lòng chọn giờ khác hoặc chọn hệ thống tự phân công.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang chuyển tới đăng nhập...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang tải dữ liệu đặt lịch...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-headline-sm text-primary mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            Chưa kết nối được dữ liệu
          </p>
          <p className="font-body-md text-on-surface-variant mb-6">{loadError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Tải lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-gutter">
        <Link href="/services" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8 font-label-md text-label-md">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Quay lại dịch vụ
        </Link>

        <div className="mb-12">
          <p className="font-label-md text-label-md text-secondary tracking-[0.2em] uppercase mb-2">Đặt lịch hẹn</p>
          <h1 className="font-headline-lg text-headline-lg text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Hành trình của bạn bắt đầu từ đây
          </h1>
        </div>

        <div className="flex items-start mb-12 overflow-x-auto pb-2 gap-0">
          {STEPS.map((stepLabel, index) => (
            <div key={stepLabel} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-sm text-label-sm transition-all border ${
                  index <= step
                    ? "bg-primary border-primary text-on-primary"
                    : "bg-transparent border-outline-variant text-on-surface-variant"
                }`}>
                  {index < step
                    ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                    : <span>{index + 1}</span>}
                </div>
                <span className={`font-label-sm text-label-sm mt-2 whitespace-nowrap text-center ${index <= step ? "text-primary" : "text-on-surface-variant"}`}
                  style={{ fontSize: 11 }}>
                  {stepLabel}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-px w-10 md:w-16 mt-4 mx-1 transition-all flex-shrink-0 ${index < step ? "bg-primary" : "bg-outline-variant"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8">
              {step === 0 && (
                <div className="stagger-up">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Chọn chi nhánh</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-3">Hệ thống sẽ đề xuất chi nhánh AuraSpa gần bạn nhất.</p>
                  <div className="mb-6 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3">
                    <p className="font-label-sm text-label-sm text-secondary">{locationStatus}</p>
                  </div>
                  <div className="space-y-3">
                    {branches.map((item) => {
                      const distance = formatDistance(item.distanceKm);

                      return (
                        <button key={item.id} onClick={() => {
                          setBranchId(item.id);
                          setSelectedTime(null);
                        }}
                          className={`w-full text-left p-5 border rounded-lg transition-all duration-200 ${
                            selectedBranchId === item.id
                              ? "border-primary bg-primary/5"
                              : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-low"
                          }`}>
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <p className="font-label-md text-label-md text-on-surface">{item.name}</p>
                                {item.isNearest && (
                                  <span className="rounded-full bg-secondary/10 px-2.5 py-1 font-label-sm text-label-sm text-secondary" style={{ fontSize: 11 }}>
                                    Gần bạn nhất
                                  </span>
                                )}
                              </div>
                              <p className="font-body-md text-body-md text-on-surface-variant" style={{ fontSize: 13 }}>{item.address}</p>
                              <div className="flex flex-wrap gap-3 mt-1">
                                <p className="font-label-sm text-label-sm text-secondary">{item.hours}</p>
                                {distance && <p className="font-label-sm text-label-sm text-primary">Cách khoảng {distance}</p>}
                              </div>
                            </div>
                            {selectedBranchId === item.id && (
                              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="stagger-up">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Chọn dịch vụ</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6">Chọn liệu trình bạn muốn trải nghiệm.</p>
                  <div className="flex gap-2 mb-6 flex-wrap">
                    {categories.map((category) => (
                      <button key={category} onClick={() => setActiveCategory(category)}
                        className={`px-4 py-2 rounded-full font-label-sm text-label-sm transition-all border ${
                          activeCategory === category
                            ? "bg-primary text-on-primary border-primary"
                            : "border-outline-variant text-on-surface-variant hover:border-primary"
                        }`}>
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {filteredServices.map((item) => (
                      <button key={item.id} onClick={() => {
                        setServiceId(item.id);
                        setSelectedTime(null);
                      }}
                        className={`w-full text-left p-5 border rounded-lg transition-all duration-200 ${
                          serviceId === item.id
                            ? "border-primary bg-primary/5"
                            : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-low"
                        }`}>
                        <div className="flex justify-between items-center gap-4">
                          <div>
                            <p className="font-label-md text-label-md text-on-surface">{item.name}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">{item.duration} phút</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-label-md text-label-md text-primary">{fmtPrice(item.price)}</span>
                            {serviceId === item.id && (
                              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: 20 }}>check_circle</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="stagger-up">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Chọn kỹ thuật viên</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6">Chọn kỹ thuật viên đang làm việc tại chi nhánh hoặc để hệ thống tự phân công.</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {therapists.map((item) => (
                      <button key={item.id} onClick={() => {
                        setTherapistId(item.id);
                        setSelectedTime(null);
                      }}
                        className={`text-left p-5 border rounded-lg transition-all duration-200 ${
                          therapistId === item.id
                            ? "border-primary bg-primary/5"
                            : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-low"
                        }`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-label-md text-label-md text-primary">
                            {item.avatar}
                          </div>
                          {therapistId === item.id && (
                            <span className="material-symbols-outlined text-primary ml-auto" style={{ fontVariationSettings: "'FILL' 1", fontSize: 18 }}>check_circle</span>
                          )}
                        </div>
                        <p className="font-label-md text-label-md text-on-surface">{item.name}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">{item.specialty}</p>
                        <p className="font-label-sm text-label-sm text-secondary mt-1">{item.experience} KN</p>
                      </button>
                    ))}
                  </div>
                  {isLoadingTherapists && (
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-3">
                      Đang tải danh sách kỹ thuật viên...
                    </p>
                  )}
                  {therapistError && (
                    <p className="font-label-sm text-label-sm text-error mb-3">{therapistError}</p>
                  )}
                  {!isLoadingTherapists && !therapistError && therapists.length === 0 && (
                    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 mb-3">
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        Chi nhánh này chưa có kỹ thuật viên khả dụng. Bạn vẫn có thể để hệ thống tự phân công.
                      </p>
                    </div>
                  )}
                  <button onClick={() => {
                    setTherapistId("auto");
                    setSelectedTime(null);
                  }}
                    className={`w-full p-4 border rounded-lg font-label-md text-label-md transition-all ${
                      therapistId === "auto"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                    }`}>
                    Để hệ thống tự phân công
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="stagger-up">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Chọn ngày & giờ</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-8">Chọn thời gian phù hợp với lịch của bạn.</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Ngày</p>
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-8">
                    {days.map((date) => {
                      const isSelected = selectedDate?.toDateString() === date.toDateString();

                      return (
                        <button key={date.toISOString()} onClick={() => {
                          setSelectedDate(date);
                          setSelectedTime(null);
                        }}
                          className={`flex-shrink-0 w-14 h-16 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all ${
                            isSelected ? "bg-primary text-on-primary border-primary" : "border-outline-variant hover:border-primary text-on-surface"
                          }`}>
                          <span className={`font-label-sm text-label-sm ${isSelected ? "text-on-primary/70" : "text-on-surface-variant"}`} style={{ fontSize: 10 }}>
                            {DAY_NAMES[date.getDay()]}
                          </span>
                          <span className="font-label-md text-label-md">{date.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Giờ</p>
                  {isLoadingSlots && (
                    <p className="font-body-sm text-on-surface-variant mb-3">Đang tải giờ trống...</p>
                  )}
                  {slotError && (
                    <p className="font-body-sm text-error mb-3">{slotError}</p>
                  )}
                  {!selectedDate && (
                    <p className="font-body-sm text-on-surface-variant mb-3">Chọn ngày để xem giờ trống.</p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTime === slot.startTime;

                      return (
                        <button key={slot.startTime} disabled={!slot.available} onClick={() => setSelectedTime(slot.startTime)}
                          className={`py-3 rounded-lg font-label-md text-label-md border transition-all ${
                            !slot.available
                              ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed"
                              : isSelected
                              ? "bg-primary text-on-primary border-primary"
                              : "border-outline-variant hover:border-primary text-on-surface"
                          }`}>
                          {slot.startTime}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDate && !isLoadingSlots && availableSlots.length === 0 && !slotError && (
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-4" style={{ fontSize: 11 }}>
                      Không có giờ trống cho ngày này.
                    </p>
                  )}
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-4" style={{ fontSize: 11 }}>
                    Ô xám = không khả dụng
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="stagger-up">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Xác nhận đặt lịch</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6">Kiểm tra thông tin trước khi xác nhận.</p>
                  <div className="border border-outline-variant/30 rounded-lg overflow-hidden mb-6">
                    {[
                      { label: "Chi nhánh", value: branch?.name ?? "", sub: branch?.address },
                      { label: "Dịch vụ", value: service?.name ?? "", sub: service ? `${service.duration} phút` : "" },
                      { label: "Kỹ thuật viên", value: therapist ? therapist.name : "Hệ thống tự phân công", sub: therapist?.specialty },
                      {
                        label: "Ngày",
                        value: selectedDate ? `${DAY_NAMES_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}` : "",
                        sub: selectedTime ?? "",
                      },
                    ].map((item, index) => (
                      <div key={item.label} className={`flex justify-between items-start gap-4 px-5 py-4 ${index < 3 ? "border-b border-outline-variant/20" : ""}`}>
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{item.label}</span>
                        <div className="text-right">
                          <p className="font-label-md text-label-md text-on-surface">{item.value}</p>
                          {item.sub && <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{item.sub}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-6 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Mã ưu đãi"
                        value={discountCode}
                        onChange={(event) => setDiscountCode(event.target.value.toUpperCase())}
                        className="custom-input flex-1"
                      />
                      <button
                        type="button"
                        className="btn-ghost px-5"
                        style={{ padding: "10px 20px", fontSize: 13 }}
                        onClick={() => setDiscountCode(normalizedDiscountCode)}
                      >
                        Áp dụng
                      </button>
                    </div>

                    {eligibleDiscountCodes.length > 0 && (
                      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
                        <p className="font-label-sm text-label-sm text-primary font-bold mb-2">Ưu đãi dành cho bạn</p>
                        <div className="flex flex-wrap gap-2">
                          {eligibleDiscountCodes.slice(0, 3).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setDiscountCode(item.code)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                item.code.toUpperCase() === normalizedDiscountCode
                                  ? "bg-primary text-on-primary border-primary"
                                  : "bg-white text-primary border-outline-variant hover:border-primary"
                              }`}
                            >
                              {item.code}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {discountLoadError && (
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{discountLoadError}</p>
                    )}

                    {selectedDiscount && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <p className="font-bold">{selectedDiscount.promotionName}</p>
                        <p>
                          Dự kiến giảm {fmtPrice(Math.round(estimatedDiscount))}. Tổng sau ưu đãi:{" "}
                          <strong>{fmtPrice(Math.round(estimatedTotal))}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="hidden" aria-hidden="true">
                    <input type="text" placeholder="Mã giảm giá" value={discountCode}
                      onChange={(event) => setDiscountCode(event.target.value)}
                      className="custom-input flex-1" />
                    <button className="btn-ghost px-5" style={{ padding: "10px 20px", fontSize: 13 }}>Áp dụng</button>
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                    Xác nhận qua SMS & Email sau khi đặt lịch.
                  </p>
                  {submitError && (
                    <p className="font-label-sm text-label-sm text-error mt-4">
                      {submitError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep((current) => current - 1)} disabled={step === 0}
                className="btn-ghost px-8 disabled:opacity-30 disabled:cursor-not-allowed">
                ← Quay lại
              </button>
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep((current) => current + 1)} disabled={!canNext()}
                  className="btn-primary flex-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  Tiếp theo →
                </button>
              ) : (
                <button onClick={handleConfirmBooking} disabled={isSubmitting} className="btn-primary flex-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  {isSubmitting ? "Đang đặt lịch..." : "Xác nhận đặt lịch"}
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 sticky top-28">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-4">Tóm tắt</p>
              {service ? (
                <div className="mb-4 pb-4 border-b border-outline-variant/20">
                  <p className="font-label-md text-label-md text-on-surface mb-1">{service.name}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{service.duration} phút</p>
                </div>
              ) : (
                <div className="mb-4 pb-4 border-b border-outline-variant/20">
                  <p className="font-label-sm text-label-sm text-on-surface-variant italic">Chưa chọn dịch vụ</p>
                </div>
              )}
              <div className="space-y-3 mb-4">
                {branch && (
                  <div className="flex justify-between gap-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Chi nhánh</span>
                    <span className="font-label-sm text-label-sm text-on-surface text-right">{branch.name}</span>
                  </div>
                )}
                {therapist !== undefined && therapistId !== null && (
                  <div className="flex justify-between gap-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Kỹ thuật viên</span>
                    <span className="font-label-sm text-label-sm text-on-surface text-right">{therapist ? therapist.name : "Tự phân công"}</span>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex justify-between gap-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Ngày</span>
                    <span className="font-label-sm text-label-sm text-on-surface">{selectedDate.getDate()}/{selectedDate.getMonth() + 1}</span>
                  </div>
                )}
                {selectedTime && (
                  <div className="flex justify-between gap-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Giờ</span>
                    <span className="font-label-sm text-label-sm text-on-surface">{selectedTime}</span>
                  </div>
                )}
              </div>
              {service && (
                <div className="pt-4 border-t border-outline-variant/20 flex justify-between items-center">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Tổng tiền</span>
                  <span className="font-headline-sm text-primary" style={{ fontFamily: "'Playfair Display', serif", fontSize: 20 }}>
                    {fmtPrice(service.price)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang tải...</p>
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
