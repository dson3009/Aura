"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "vi" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyOrVi: string, en?: string) => string;
  tService: (text: string | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const serviceTranslations: Record<string, string> = {
  // Service Names
  "Chăm sóc da mặt cơ bản": "Basic Facial Care",
  "Trị liệu da chuyên sâu": "Intensive Skin Therapy",
  "Massage body thư giãn": "Relaxing Body Massage",
  "Tắm trắng toàn thân": "Full Body Whitening",
  "Làm nail cơ bản": "Basic Nails",
  "Gói spa truyền thống": "Traditional Spa Package",
  "Massage Thụy Điển Cổ Điển": "Classic Swedish Massage",
  "Gói \"Tâm An\" Serenity Journey": "\"Serenity Journey\" Package",
  "Gói \"Song Hành\" Couples Retreat": "\"Couples Retreat\" Package",
  "Cấp Ẩm Chuyên Sâu Radiance": "Radiance Deep Hydration",
  "Trẻ Hóa Da Tế Bào Gốc": "Stem Cell Skin Rejuvenation",
  "Massage Đá Nóng Núi Lửa": "Volcanic Hot Stone Massage",
  "Ủ Bùn Khoáng Thiên Nhiên": "Natural Mineral Mud Wrap",
  "Tẩy Tế Bào Chết Muối Biển & Cà Phê": "Sea Salt & Coffee Scrub",
  
  // Service Descriptions
  "Làm sạch, tẩy tế bào chết và dưỡng ẩm chuyên sâu cho da mặt.": "Cleansing, exfoliating, and deep hydration for the face.",
  "Liệu trình trị liệu da chuyên sâu dành cho da nhạy cảm và da dầu.": "Intensive skin treatment course for sensitive and oily skin.",
  "Massage toàn thân kết hợp tinh dầu thiên nhiên giúp thư giãn và giảm căng thẳng.": "Full-body massage combined with natural essential oils to relax and reduce stress.",
  "Liệu trình tắm trắng toàn thân bằng công nghệ hiện đại.": "Full-body skin whitening course using modern technology.",
  "Chăm sóc móng tay và chân, sơn gel bền màu.": "Manicure and pedicure care with long-lasting gel polish.",
  "Gói spa toàn thân kết hợp phương pháp truyền thống Việt Nam. Đã ngừng cung cấp.": "Full body spa package combining traditional Vietnamese methods. Discontinued.",
  "Sự kết hợp giữa các động tác xoa bóp nhẹ nhàng và tinh dầu thiên nhiên giúp giảm căng thẳng cơ bắp.": "A combination of gentle massage strokes and natural essential oils to relieve muscle tension.",
  "Massage đá nóng 90 phút, chăm sóc da mặt Radiance 60 phút, trà thảo mộc và quà tặng tinh dầu Aura.": "90-minute hot stone massage, 60-minute Radiance facial care, herbal tea, and Aura essential oil gift.",
  "Phòng VIP đôi, massage Thụy Điển 75 phút và tẩy tế bào chết toàn thân cho hai người.": "Double VIP room, 75-minute Swedish massage, and full body scrub for two.",
  "Khôi phục độ ẩm tự nhiên của da bằng tinh chất HA và vitamin, mang lại làn da căng bóng và rạng rỡ ngay lập tức.": "Restore natural skin moisture with HA essence and vitamins, yielding instant glowing and radiant skin.",
  "Liệu pháp chống lão hóa sử dụng ánh sáng sinh học và tế bào gốc thực vật quý hiếm để tái tạo làn da.": "Anti-aging therapy using biological light and rare plant stem cells to regenerate the skin.",
  "Năng lượng từ đá bazan nóng tác động sâu vào các huyệt đạo, giúp thải độc tố và xua tan mệt mỏi tích tụ.": "Energy from hot basalt stones deeply stimulates acupoints, helping detoxify and relieve accumulated fatigue.",
  "Cung cấp khoáng chất thiết yếu, giúp thải độc qua da và làm sáng mịn tông da toàn thân.": "Provides essential minerals to help detoxify the skin and brighten overall body skin tone.",
  "Làm mịn da và kích thích tái tạo tế bào mới với muối biển hạt mịn và cà phê Đắk Lắk.": "Smooth skin and stimulate new cell regeneration with fine sea salt and Dak Lak coffee.",

  // Branch Names
  "Aura Spa – Quận 1": "Aura Spa – District 1",
  "Aura Spa - Quận 1": "Aura Spa - District 1",
  "AuraSpa – Quận 1": "AuraSpa – District 1",
  "AuraSpa - Quận 1": "AuraSpa - District 1",
  
  "Aura Spa – Quận 7": "Aura Spa – District 7",
  "Aura Spa - Quận 7": "Aura Spa - District 7",
  "AuraSpa – Quận 7": "AuraSpa – District 7",
  "AuraSpa - Quận 7": "AuraSpa - District 7",
  
  "Aura Spa – Hoàn Kiếm": "Aura Spa – Hoan Kiem",
  "Aura Spa - Hoàn Kiếm": "Aura Spa - Hoan Kiem",
  "AuraSpa – Hoàn Kiếm": "AuraSpa – Hoan Kiem",
  "AuraSpa - Hoàn Kiếm": "AuraSpa - Hoan Kiem",
  
  "Aura Spa – Thủ Đức": "Aura Spa – Thu Duc",
  "Aura Spa - Thủ Đức": "Aura Spa - Thu Duc",
  "AuraSpa – Thủ Đức": "AuraSpa – Thu Duc",
  "AuraSpa - Thủ Đức": "AuraSpa - Thu Duc",
  
  "Aura Spa - Đà Nẵng Sông Hàn": "Aura Spa - Da Nang Han River",
  "Aura Spa – Đà Nẵng Sông Hàn": "Aura Spa – Da Nang Han River",
  "AuraSpa - Đà Nẵng Sông Hàn": "AuraSpa - Da Nang Han River",
  "AuraSpa – Đà Nẵng Sông Hàn": "AuraSpa – Da Nang Han River",
  "Aura Spa - Đà Nẵng - Sông Hàn": "Aura Spa - Da Nang Han River",
  "AuraSpa - Đà Nẵng - Sông Hàn": "AuraSpa - Da Nang Han River",

  "Aura Spa - Biển Mỹ Khê": "Aura Spa - My Khe Beach",
  "Aura Spa – Biển Mỹ Khê": "Aura Spa – My Khe Beach",
  "AuraSpa - Biển Mỹ Khê": "AuraSpa - My Khe Beach",
  "AuraSpa – Biển Mỹ Khê": "AuraSpa – My Khe Beach",
  "Aura Spa - Đà Nẵng - Mỹ Khê": "Aura Spa - My Khe Beach",
  "AuraSpa - Đà Nẵng - Mỹ Khê": "AuraSpa - My Khe Beach",

  "Aura Spa - Ngũ Hành Sơn": "Aura Spa - Ngu Hanh Son",
  "Aura Spa – Ngũ Hành Sơn": "Aura Spa – Ngu Hanh Son",
  "AuraSpa - Ngũ Hành Sơn": "AuraSpa - Ngu Hanh Son",
  "AuraSpa – Ngũ Hành Sơn": "AuraSpa – Ngu Hanh Son",
  "Aura Spa - Đà Nẵng - Ngũ Hành Sơn": "Aura Spa - Ngu Hanh Son",
  "AuraSpa - Đà Nẵng - Ngũ Hành Sơn": "AuraSpa - Ngu Hanh Son",

  // Branch Addresses
  "123 Nguyen Hue, Phuong Ben Nghe, Quan 1": "123 Nguyen Hue, Ben Nghe Ward, District 1",
  "456 Nguyen Thi Thap, Phuong Tan Phu, Quan 7": "456 Nguyen Thi Thap, Tan Phu Ward, District 7",
  "78 Hang Bai, Phuong Tran Hung Dao, Quan Hoan Kiem": "78 Hang Bai, Tran Hung Dao Ward, Hoan Kiem District",
  "99 Vo Van Ngan, Phuong Binh Tho, TP Thu Đức": "99 Vo Van Ngan, Binh Tho Ward, Thu Duc City",
  "88 Bạch Đằng, Hải Châu, Đà Nẵng": "88 Bach Dang, Hai Chau, Da Nang",
  "12 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng": "12 Vo Nguyen Giap, Son Tra, Da Nang",
  "25 Lê Văn Hiến, Ngũ Hành Sơn, Đà Nẵng": "25 Le Van Hien, Ngu Hanh Son, Da Nang",

  // Service Categories
  "Facial": "Facial Care",
  "Body": "Body Care",
  "Massage": "Massage Therapy",
  "Package": "Service Packages",
  "Nail": "Nail Care",
  "Spa": "General Spa",
  "Chăm sóc da mặt": "Facial Care",
  "Gói dịch vụ": "Service Packages",
  "Chăm sóc cơ thể": "Body Care",
  "Massage trị liệu": "Massage Therapy",
  "Spa tổng hợp": "General Spa",
  "Khác": "Other",

  // Districts & Cities
  "Quan 1": "District 1",
  "Quan 7": "District 7",
  "Hoan Kiem": "Hoan Kiem District",
  "Thu Duc": "Thu Duc City",
  "Hai Chau": "Hai Chau District",
  "Son Tra": "Son Tra District",
  "Ngu Hanh Son": "Ngu Hanh Son District",
  "Quận 1": "District 1",
  "Quận 7": "District 7",
  "Hoàn Kiếm": "Hoan Kiem District",
  "Thủ Đức": "Thu Duc City",
  "Hải Châu": "Hai Chau District",
  "Sơn Trà": "Son Tra District",
  "Ngũ Hành Sơn": "Ngu Hanh Son District",
  "Da Nang": "Da Nang",
  "Đà Nẵng": "Da Nang",
  "Hanoi": "Hanoi",
  "Hà Nội": "Hanoi",
  "Ho Chi Minh City": "Ho Chi Minh City",
  "Hồ Chí Minh": "Ho Chi Minh City"
};

const translations: Record<Language, Record<string, string>> = {
  vi: {
    "common.home": "Trang chủ",
    "common.services": "Dịch vụ",
    "common.branches": "Chi nhánh",
    "common.promotions": "Khuyến mãi",
    "common.about": "Về chúng tôi",
    "common.story": "Câu chuyện",
    "common.membership": "Chương trình thành viên",
    "common.contact": "Liên hệ",
    "common.bookNow": "Đặt lịch ngay",
    "common.login": "Đăng nhập",
    "common.register": "Đăng ký",
    "common.language": "Ngôn ngữ",
    "account.customer": "Khách hàng",
    "account.manage": "Quản lý tài khoản",
    "account.myBookings": "Lịch hẹn của tôi",
    "account.myReviews": "Đánh giá của tôi",
    "account.todaySchedule": "Lịch trình hôm nay",
    "account.onlineConsult": "Tư vấn trực tuyến",
    "account.branchOverview": "Tổng quan chi nhánh",
    "account.approveShifts": "Duyệt ca làm",
    "account.systemOverview": "Tổng quan hệ thống",
    "account.manageServices": "Quản lý dịch vụ",
    "account.logout": "Đăng xuất",
    "auth.emailOrUsername": "Email hoặc tên đăng nhập",
    "auth.password": "Mật khẩu",
    "auth.rememberMe": "Ghi nhớ tôi",
    "auth.forgotPassword": "Quên mật khẩu?",
    "auth.loginNow": "Đăng nhập ngay",
    "auth.orContinueWith": "Hoặc tiếp tục với",
    "auth.noAccount": "Chưa có tài khoản?",
    "auth.registerNow": "Đăng ký ngay",
    "auth.invalidEmail": "Vui lòng nhập email hợp lệ.",
    "auth.invalidPassword": "Email hoặc mật khẩu không đúng.",
    "auth.locked": "Tài khoản bị khóa 30 phút do đăng nhập sai quá nhiều lần.",
    "auth.forgotTitle": "Quên mật khẩu",
    "auth.recoverAccount": "Khôi phục tài khoản",
    "auth.recoverHint": "Nhập email đã đăng ký. Chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.",
    "auth.sendOtp": "Gửi mã OTP",
    "auth.sending": "Đang gửi...",
    "auth.saving": "Đang lưu...",
    "auth.otpSentIfExists": "Mã OTP đã được gửi nếu email tồn tại trong hệ thống.",
    "auth.sendOtpFailed": "Không gửi được OTP. Vui lòng thử lại.",
    "auth.otpSixDigits": "Vui lòng nhập mã OTP gồm 6 chữ số.",
    "auth.newPasswordMinError": "Mật khẩu mới phải có ít nhất 8 ký tự.",
    "auth.confirmPasswordMismatch": "Mật khẩu xác nhận không khớp.",
    "auth.resetPasswordFailed": "Không đặt lại được mật khẩu. Vui lòng kiểm tra OTP và thử lại.",
    "auth.backToLogin": "Quay lại đăng nhập",
    "auth.verifyOtp": "Xác minh OTP",
    "auth.enterOtp": "Nhập mã xác minh",
    "auth.otpSent": "Mã đã được gửi đến",
    "auth.yourEmail": "email của bạn",
    "auth.resendAfter": "Gửi lại sau",
    "auth.resend": "Gửi lại",
    "auth.confirm": "Xác nhận",
    "auth.back": "Quay lại",
    "auth.resetPassword": "Đặt lại mật khẩu",
    "auth.newPassword": "Mật khẩu mới",
    "auth.minPassword": "Tối thiểu 8 ký tự",
    "auth.confirmPassword": "Xác nhận mật khẩu",
    "auth.reenterPassword": "Nhập lại mật khẩu mới",
    "auth.savePassword": "Lưu mật khẩu",
    "auth.passwordChanged": "Đổi mật khẩu thành công",
    "auth.passwordChangedHint": "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.",
    "auth.backToLoginPage": "Về trang đăng nhập",
    "footer.company": "CÔNG TY",
    "footer.explore": "KHÁM PHÁ",
    "footer.info": "THÔNG TIN",
    "footer.newsletter": "BẢN TIN",
    "footer.subscribeNewsletter": "Nhận tin tức spa hằng tuần",
  },
  en: {
    "common.home": "Home",
    "common.services": "Services",
    "common.branches": "Branches",
    "common.promotions": "Promotions",
    "common.about": "About Us",
    "common.story": "Our Story",
    "common.membership": "Membership",
    "common.contact": "Contact",
    "common.bookNow": "Book Now",
    "common.login": "Login",
    "common.register": "Register",
    "common.language": "Language",
    "account.customer": "Customer",
    "account.manage": "Manage Account",
    "account.myBookings": "My Bookings",
    "account.myReviews": "My Reviews",
    "account.todaySchedule": "Today's Schedule",
    "account.onlineConsult": "Online Consultation",
    "account.branchOverview": "Branch Overview",
    "account.approveShifts": "Approve Shifts",
    "account.systemOverview": "System Overview",
    "account.manageServices": "Manage Services",
    "account.logout": "Log Out",
    "auth.emailOrUsername": "Email or username",
    "auth.password": "Password",
    "auth.rememberMe": "Remember me",
    "auth.forgotPassword": "Forgot password?",
    "auth.loginNow": "Login Now",
    "auth.orContinueWith": "Or continue with",
    "auth.noAccount": "Do not have an account?",
    "auth.registerNow": "Register now",
    "auth.invalidEmail": "Please enter a valid email.",
    "auth.invalidPassword": "Email or password is incorrect.",
    "auth.locked": "Your account is locked for 30 minutes after too many failed login attempts.",
    "auth.forgotTitle": "Forgot Password",
    "auth.recoverAccount": "Recover Account",
    "auth.recoverHint": "Enter your registered email. We will send an OTP to reset your password.",
    "auth.sendOtp": "Send OTP",
    "auth.sending": "Sending...",
    "auth.saving": "Saving...",
    "auth.otpSentIfExists": "The OTP has been sent if the email exists in the system.",
    "auth.sendOtpFailed": "Could not send OTP. Please try again.",
    "auth.otpSixDigits": "Please enter a 6-digit OTP.",
    "auth.newPasswordMinError": "New password must be at least 8 characters.",
    "auth.confirmPasswordMismatch": "Confirmation password does not match.",
    "auth.resetPasswordFailed": "Could not reset password. Please check the OTP and try again.",
    "auth.backToLogin": "Back to login",
    "auth.verifyOtp": "Verify OTP",
    "auth.enterOtp": "Enter verification code",
    "auth.otpSent": "The code was sent to",
    "auth.yourEmail": "your email",
    "auth.resendAfter": "Resend after",
    "auth.resend": "Resend",
    "auth.confirm": "Confirm",
    "auth.back": "Back",
    "auth.resetPassword": "Reset Password",
    "auth.newPassword": "New Password",
    "auth.minPassword": "At least 8 characters",
    "auth.confirmPassword": "Confirm Password",
    "auth.reenterPassword": "Re-enter new password",
    "auth.savePassword": "Save Password",
    "auth.passwordChanged": "Password Changed",
    "auth.passwordChangedHint": "Your password has been updated. Please log in again.",
    "auth.backToLoginPage": "Back to Login",
    "footer.company": "COMPANY",
    "footer.explore": "EXPLORE",
    "footer.info": "INFORMATION",
    "footer.newsletter": "NEWSLETTER",
    "footer.subscribeNewsletter": "Get weekly spa updates",
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("vi");

  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = localStorage.getItem("language");
      if (saved === "vi" || saved === "en") {
        setLanguageState(saved);
      } else if (saved) {
        localStorage.setItem("language", "vi");
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (keyOrVi: string, en?: string): string => {
    if (typeof en === "string") {
      return language === "en" ? en : keyOrVi;
    }

    return translations[language][keyOrVi] || keyOrVi;
  };

  const tService = (text: string | null | undefined): string => {
    if (!text) return "";
    if (language !== "en") return text;
    return serviceTranslations[text] || text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tService }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
