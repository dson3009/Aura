"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { validateName, validatePhone } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";
import { authService } from "@/lib/services/auth.service";

export default function AccountPage() {
  const { language } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const { user, isLoading, updateProfile, logout } = useAuth();
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        setIsLoadingProfile(false);
        return;
      }

      setName(user.name ?? "");
      setPhone(user.phone ?? "");

      try {
        setIsLoadingProfile(true);
        const profile = await authService.getMe();
        if (cancelled) return;

        setName(profile.fullName ?? user.name ?? "");
        setPhone(profile.phone ?? user.phone ?? "");
      } catch {
        if (!cancelled) {
          setName(user.name ?? "");
          setPhone(user.phone ?? "");
        }
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoading, user?.id]);

  const handleSaveProfile = async () => {
    const e: Record<string, string> = {};
    const nameErr = validateName(name);
    if (nameErr) e.name = nameErr;
    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) e.phone = phoneErr;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    try {
      setIsSavingProfile(true);
      const updated = await authService.updateProfile({
        fullName: name.trim(),
        phone: phone.trim() || undefined,
      });
      updateProfile({ name: updated.fullName, phone: updated.phone ?? undefined });
      showToast(t("✓ Hồ sơ đã được cập nhật", "✓ Profile updated successfully"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Không thể cập nhật hồ sơ.", "Could not update profile."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPw = t("Vui lòng nhập mật khẩu hiện tại.", "Please enter your current password.");
    if (!newPw || newPw.length < 8) e.newPw = t("Mật khẩu phải có ít nhất 8 ký tự.", "Password must be at least 8 characters.");
    else if (!/[A-Z]/.test(newPw)) e.newPw = t("Mật khẩu phải có ít nhất 1 chữ hoa.", "Password must contain at least 1 uppercase letter.");
    else if (!/[0-9]/.test(newPw)) e.newPw = t("Mật khẩu phải có ít nhất 1 chữ số.", "Password must contain at least 1 number.");
    if (newPw !== confirmPw) e.confirmPw = t("Mật khẩu xác nhận không khớp.", "Confirm password does not match.");
    setPwErrors(e);
    if (Object.keys(e).length > 0) return;
    try {
      setIsSavingPassword(true);
      await authService.updateProfile({ currentPassword: currentPw, password: newPw });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToast(t("✓ Mật khẩu đã được cập nhật thành công", "✓ Password updated successfully"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setPwErrors({
        currentPw: message || t("Không thể cập nhật mật khẩu. Kiểm tra mật khẩu hiện tại.", "Could not update password. Check your current password."),
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const roleLabel: Record<string, string> = {
    customer: t("Khách hàng", "Customer"), 
    staff: t("Nhân viên", "Staff"), 
    manager: t("Quản lý chi nhánh", "Branch Manager"), 
    admin: t("Chủ sở hữu", "System Owner"),
    owner: t("Chủ sở hữu", "System Owner"),
  };

  if (isLoading || isLoadingProfile) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-on-surface-variant">
        {t("Đang tải thông tin tài khoản...", "Loading account profile...")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-on-surface-variant">
        {t("Không tìm thấy phiên đăng nhập.", "No active session found.")}
      </div>
    );
  }

  const initials = user?.name.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase() ?? "?";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {toast && <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">{toast}</div>}

      <h1 className="font-headline-md text-headline-md text-primary mb-6">
        {t("Thông tin tài khoản", "Account Profile")}
      </h1>

      {/* Avatar + role */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xl">
          {initials}
        </div>
        <div>
          <p className="font-headline-sm text-headline-sm text-on-surface">{user?.name}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{user?.email}</p>
          <span className="mt-1 inline-block bg-primary text-on-primary text-xs font-bold px-3 py-0.5 rounded-full">
            {roleLabel[user?.role ?? "customer"]}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 mb-6">
        {(["profile", "password"] as const).map((tId) => (
          <button key={tId} onClick={() => setTab(tId)}
            className={`flex-1 py-3 font-label-md text-label-md transition-all border-b-2 ${tab === tId ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"}`}>
            {tId === "profile" ? t("Thông tin cá nhân", "Personal Info") : t("Đổi mật khẩu", "Change Password")}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-5">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
              {t("Họ và tên", "Full Name")}
            </label>
            <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors ${errors.name ? "border-error" : "border-outline-variant"}`}
              value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} />
            {errors.name && <p className="text-error text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
              {t("Email (không thể thay đổi)", "Email (cannot be changed)")}
            </label>
            <input className="w-full border border-outline-variant/40 rounded-lg px-3 py-2 text-sm bg-surface-container text-on-surface-variant cursor-not-allowed" value={user?.email ?? ""} disabled />
            <p className="text-xs text-on-surface-variant mt-1">
              {t("Email là định danh chính và không thể thay đổi.", "Email is the primary identifier and cannot be changed.")}
            </p>
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">
              {t("Số điện thoại", "Phone Number")}
            </label>
            <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors ${errors.phone ? "border-error" : "border-outline-variant"}`}
              placeholder="0912345678" value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: "" })); }} />
            {errors.phone && <p className="text-error text-xs mt-1">{errors.phone}</p>}
          </div>
          <button
            onClick={() => void handleSaveProfile()}
            disabled={isSavingProfile}
            className="w-full bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingProfile ? t("Đang lưu...", "Saving...") : t("Lưu thay đổi", "Save Changes")}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-5">
          {[
            { label: t("Mật khẩu hiện tại", "Current Password"), key: "currentPw", value: currentPw, setter: setCurrentPw, errKey: "currentPw" },
            { label: t("Mật khẩu mới", "New Password"), key: "newPw", value: newPw, setter: setNewPw, errKey: "newPw" },
            { label: t("Xác nhận mật khẩu mới", "Confirm New Password"), key: "confirmPw", value: confirmPw, setter: setConfirmPw, errKey: "confirmPw" },
          ].map(({ label, key, value, setter, errKey }) => (
            <div key={key}>
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">{label}</label>
              <input type="password" className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors ${pwErrors[errKey] ? "border-error" : "border-outline-variant"}`}
                placeholder="••••••••" value={value}
                onChange={(e) => { setter(e.target.value); setPwErrors((p) => ({ ...p, [errKey]: "" })); }} />
              {pwErrors[errKey] && <p className="text-error text-xs mt-1">{pwErrors[errKey]}</p>}
            </div>
          ))}
          <p className="text-xs text-on-surface-variant">
            {t("Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa và chữ số.", "Password must be at least 8 characters, including uppercase letters and numbers.")}
          </p>
          <button
            onClick={() => void handleChangePassword()}
            disabled={isSavingPassword}
            className="w-full bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingPassword ? t("Đang cập nhật...", "Updating...") : t("Cập nhật mật khẩu", "Update Password")}
          </button>
          <hr className="border-outline-variant/20" />
          <button onClick={logout} className="w-full border-2 border-error text-error py-3 rounded-full font-label-md text-label-md hover:bg-error-container/20 flex items-center justify-center gap-2 font-bold">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            {t("Đăng xuất khỏi tài khoản", "Log Out of Account")}
          </button>
        </div>
      )}
    </div>
  );
}
