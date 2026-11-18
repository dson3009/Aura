"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/lib/services/auth.service";

interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  currentPassword: string;
  password: string;
  notify: boolean;
}

const emptyProfile: ProfileForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "other",
  address: "",
  currentPassword: "",
  password: "",
  notify: true,
};

function normalizeDate(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function ProfilePage() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      try {
        const user = await authService.getMe();
        if (ignore) return;

        setProfile({
          fullName: user.fullName || "",
          email: user.email || "",
          phone: user.phone || "",
          dateOfBirth: normalizeDate(user.dateOfBirth),
          gender: user.gender || "other",
          address: user.address || "",
          currentPassword: "",
          password: "",
          notify: user.notificationEnabled ?? true,
        });
      } catch (err) {
        const text = err instanceof Error ? err.message : "Không tải được thông tin tài khoản.";
        if (!ignore) setError(text);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

  const updateField = (field: keyof ProfileForm, value: string | boolean) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newPassword = profile.password.trim();
    if (newPassword && !profile.currentPassword) {
      setMessage(null);
      setError("Vui long nhap mat khau hien tai de doi mat khau.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      setError(null);

      const updated = await authService.updateProfile({
        fullName: profile.fullName.trim(),
        phone: profile.phone.trim(),
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth || undefined,
        address: profile.address.trim() || undefined,
        notificationEnabled: profile.notify,
        currentPassword: newPassword ? profile.currentPassword : undefined,
        password: newPassword || undefined,
      });

      updateProfile({
        name: updated.fullName,
        email: updated.email,
        phone: updated.phone ?? undefined,
        avatar: updated.avatarUrl ?? undefined,
        notificationEnabled: updated.notificationEnabled ?? true,
      });

      setProfile((current) => ({
        ...current,
        fullName: updated.fullName || current.fullName,
        email: updated.email || current.email,
        phone: updated.phone || current.phone,
        dateOfBirth: normalizeDate(updated.dateOfBirth),
        gender: updated.gender || current.gender,
        address: updated.address || "",
        currentPassword: "",
        password: "",
        notify: updated.notificationEnabled ?? true,
      }));
      setMessage("Đã lưu thay đổi thành công.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Không lưu được thay đổi.";
      setError(text);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-gutter">
        <div className="mb-10">
          <p className="font-label-md text-secondary tracking-[0.2em] uppercase mb-2">AuraSpa</p>

          <h1
            className="text-primary mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "44px",
              lineHeight: "52px",
            }}
          >
            Quản lý tài khoản
          </h1>

          <p className="text-on-surface-variant">
            Cập nhật thông tin cá nhân và mật khẩu của bạn.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 rounded-full bg-primary-fixed flex items-center justify-center text-primary text-3xl font-bold">
              {profile.fullName?.charAt(0)?.toUpperCase() || "K"}
            </div>

            <h2
              className="mt-4 text-primary"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "28px",
              }}
            >
              {profile.fullName || "Khách hàng"}
            </h2>

            <p className="text-on-surface-variant">{profile.email}</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block mb-2 text-on-surface-variant">Họ và tên</label>
              <input
                value={profile.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="custom-input w-full"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-on-surface-variant">Số điện thoại</label>
                <input
                  value={profile.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="custom-input w-full"
                  placeholder="Nhập số điện thoại 10 chữ số"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block mb-2 text-on-surface-variant">Ngày sinh</label>
                <input
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(event) => updateField("dateOfBirth", event.target.value)}
                  className="custom-input w-full"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-on-surface-variant">Giới tính</label>
                <select
                  value={profile.gender}
                  onChange={(event) => updateField("gender", event.target.value)}
                  className="custom-input w-full"
                >
                  <option value="female">Nữ</option>
                  <option value="male">Nam</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-on-surface-variant">Email</label>
                <input value={profile.email} disabled className="custom-input w-full opacity-60" />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-on-surface-variant">Địa chỉ</label>
              <input
                value={profile.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="custom-input w-full"
                placeholder="Nhập địa chỉ liên hệ"
              />
            </div>

            <div>
              <label className="block mb-2 text-on-surface-variant">Mật khẩu mới</label>
              <input
                type="password"
                value={profile.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="custom-input w-full"
                placeholder="Để trống nếu không muốn đổi mật khẩu"
              />
            </div>

            {profile.password && (
              <div>
                <label className="block mb-2 text-on-surface-variant">Mat khau hien tai</label>
                <input
                  type="password"
                  value={profile.currentPassword}
                  onChange={(event) => updateField("currentPassword", event.target.value)}
                  className="custom-input w-full"
                  placeholder="Nhap mat khau hien tai de xac nhan doi mat khau"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            <div className="border-t border-outline-variant/20 pt-8">
              <h3
                className="text-primary mb-4"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "24px",
                }}
              >
                Tiện ích
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  href="/customer/bookings"
                  className="p-5 border border-outline-variant rounded-lg hover:border-primary transition-all"
                >
                  <p className="font-medium text-primary mb-1">Lịch hẹn của tôi</p>
                  <p className="text-sm text-on-surface-variant">Xem và quản lý lịch hẹn</p>
                </Link>

                <Link
                  href="/services"
                  className="p-5 border border-outline-variant rounded-lg hover:border-primary transition-all"
                >
                  <p className="font-medium text-primary mb-1">Dịch vụ AuraSpa</p>
                  <p className="text-sm text-on-surface-variant">Khám phá và đặt liệu trình mới</p>
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-between border border-outline-variant/30 rounded-lg p-5">
              <div>
                <p className="font-medium text-on-surface">Thông báo Email/SMS</p>
                <p className="text-sm text-on-surface-variant">Nhận cập nhật về lịch hẹn</p>
              </div>

              <input
                type="checkbox"
                checked={profile.notify}
                onChange={(event) => updateField("notify", event.target.checked)}
                className="w-5 h-5"
                style={{ accentColor: "#713323" }}
              />
            </div>

            {message && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-primary">
                {message}
              </div>
            )}

            {error && (
              <div className="bg-error-container/30 border border-error/20 rounded-lg p-4 text-error">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSaving} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
