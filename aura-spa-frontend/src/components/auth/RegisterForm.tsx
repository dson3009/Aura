"use client";

import { useState } from "react";
import { authService } from "@/lib/services/auth.service";

interface RegisterFormProps {
  onSwitchTab: (tab: "login") => void;
}

type Step = 1 | 2 | 3;

export default function RegisterForm({ onSwitchTab }: RegisterFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwScore, setPwScore] = useState(0);
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  // mới: lưu OTP, trạng thái loading, lỗi
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkPw = (v: string) => {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    setPwScore(s);
  };

  const startTimer = () => {
    setCountdown(59); setCanResend(false);
    let t = 59;
    const iv = setInterval(() => {
      t--; setCountdown(t);
      if (t <= 0) { clearInterval(iv); setCanResend(true); }
    }, 1000);
  };

  // BƯỚC 1 → 2: gọi API đăng ký, BE gửi OTP qua mail
  const handleRegister = async () => {
    setError("");
    // validate cơ bản
    if (!lastName || !firstName || !email || !phone || !password) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    if (password !== confirmPw) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      await authService.register({
        fullName: `${lastName} ${firstName}`.trim(),
        email,
        phone,
        password,
        dateOfBirth: dob || undefined,
      });
      setStep(2);
      startTimer();
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2 → 3: gọi API xác minh OTP
  const handleVerify = async () => {
    setError("");
    if (otp.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    setLoading(true);
    try {
      await authService.verifyEmail(email, otp);
      localStorage.setItem("userName", `${lastName} ${firstName}`);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Mã OTP không đúng.");
    } finally {
      setLoading(false);
    }
  };

  // gửi lại OTP
  const handleResend = async () => {
    setError("");
    try {
      await authService.resendOtp(email);
      startTimer();
    } catch (err: any) {
      setError(err.message || "Không gửi lại được mã.");
    }
  };

  const pwColors = ["#ba1a1a","#EF9F27","#1D9E75","#713323"];
  const pwLabels = ["Yếu","Trung bình","Mạnh","Rất mạnh"];

  return (
    <div className="stagger-up">
      <div className="flex gap-2 mb-6">
        {[1,2,3].map((i) => (
          <div key={i} style={{ height:3,flex:1,borderRadius:2,background:i<=step?"#713323":"#d9c1bc",transition:"background 0.4s" }} />
        ))}
      </div>

      {/* hiển thị lỗi chung */}
      {error && (
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background:"#ffdad6",fontSize:12,color:"#93000a" }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-primary font-display" style={{ fontSize:20 }}>Thông tin cá nhân</h3>
            <span className="text-on-surface-variant" style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em" }}>BƯỚC 1 / 3</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Họ</label>
              <input className="custom-input w-full" placeholder="Nguyễn" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Tên</label>
              <input className="custom-input w-full" placeholder="Văn A" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-4 mb-6">
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Email</label>
              <input className="custom-input w-full" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Số điện thoại</label>
              <input className="custom-input w-full" type="tel" placeholder="0912 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Ngày sinh</label>
              <input className="custom-input w-full" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Mật khẩu</label>
              <div className="relative">
                <input className="custom-input w-full" type={showPw?"text":"password"} placeholder="Tối thiểu 8 ký tự"
                  style={{ paddingRight:36 }} value={password}
                  onChange={(e) => { setPassword(e.target.value); checkPw(e.target.value); }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:"absolute",right:0,bottom:12,background:"none",border:"none",cursor:"pointer",color:"#86736e" }}>
                  <span className="material-symbols-outlined" style={{ fontSize:20 }}>{showPw?"visibility_off":"visibility"}</span>
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {[0,1,2,3].map((i) => (
                  <div key={i} style={{ flex:1,height:2,borderRadius:1,background:i<pwScore?pwColors[pwScore-1]:"#d9c1bc",transition:"background 0.3s" }} />
                ))}
              </div>
              <p style={{ fontSize:11,marginTop:4,color:password?pwColors[pwScore-1]:"#86736e" }}>
                {password ? pwLabels[pwScore-1]||"Yếu" : "Nhập mật khẩu để kiểm tra độ mạnh"}
              </p>
            </div>
            <div>
              <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Xác nhận mật khẩu</label>
              <input className="custom-input w-full" type="password" placeholder="Nhập lại mật khẩu" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full mb-4 flex items-center justify-center gap-2" onClick={handleRegister} disabled={loading}>
            {loading ? "ĐANG XỬ LÝ..." : <>TIẾP THEO <span className="material-symbols-outlined" style={{ fontSize:18 }}>arrow_forward</span></>}
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div style={{ height:1,flex:1,background:"rgba(217,193,188,0.5)" }} />
            <span style={{ fontSize:12,color:"#86736e" }}>hoặc đăng ký bằng</span>
            <div style={{ height:1,flex:1,background:"rgba(217,193,188,0.5)" }} />
          </div>
          <button type="button" className="btn-social w-full mb-4 flex items-center justify-center gap-3" onClick={authService.loginWithGoogle}>
            <GoogleIcon /><span style={{ fontSize:13,fontWeight:600 }}>Tiếp tục với Google</span>
          </button>
          <p className="text-center text-on-surface-variant" style={{ fontSize:13 }}>
            Đã có tài khoản?{" "}
            <button onClick={() => onSwitchTab("login")} className="text-primary font-semibold"
              style={{ background:"none",border:"none",cursor:"pointer",fontFamily:"inherit" }}>Đăng nhập</button>
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-primary font-display" style={{ fontSize:20 }}>Xác minh email</h3>
            <span className="text-on-surface-variant" style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em" }}>BƯỚC 2 / 3</span>
          </div>
          <p className="text-on-surface-variant mb-6" style={{ fontSize:14,lineHeight:1.7 }}>
            Mã OTP 6 chữ số đã gửi đến<br /><strong className="text-on-surface">{email||"email của bạn"}</strong>
          </p>
          <OtpBoxes onChange={setOtp} />
          <div className="flex justify-between items-center mb-6" style={{ fontSize:12,color:"#53433f" }}>
            {!canResend ? <span>Gửi lại sau <strong>{countdown}s</strong></span> : <span />}
            {canResend && <button className="text-primary font-semibold" style={{ background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12 }} onClick={handleResend}>Gửi lại</button>}
          </div>
          <button className="btn-primary w-full mb-3" onClick={handleVerify} disabled={loading}>
            {loading ? "ĐANG XÁC MINH..." : "XÁC MINH"}
          </button>
          <button className="btn-ghost w-full" onClick={() => setStep(1)}>← Quay lại</button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center pt-2">
          <div className="flex items-center justify-end mb-4">
            <span className="text-on-surface-variant" style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em" }}>BƯỚC 3 / 3</span>
          </div>
          <div className="check-circle mx-auto mb-5">
            <span className="material-symbols-outlined" style={{ fontSize:36,color:"#2d6a4f" }}>check</span>
          </div>
          <h3 className="text-primary font-display mb-3" style={{ fontSize:22 }}>Chào mừng đến AuraSpa</h3>
          <p className="text-on-surface-variant mb-6 px-4" style={{ fontSize:14,lineHeight:1.7 }}>
            Tài khoản đã được tạo thành công.<br />Hãy bắt đầu hành trình chăm sóc bản thân.
          </p>
          <div className="rounded-xl p-5 mb-6 text-left" style={{ background:"#fbf2ed",border:"1px solid rgba(217,193,188,0.5)" }}>
            <p className="text-on-surface-variant uppercase tracking-widest mb-2" style={{ fontSize:11,fontWeight:600 }}>Tài khoản của bạn</p>
            <p className="font-semibold text-on-surface" style={{ fontSize:15 }}>{lastName} {firstName||"Khách hàng"}</p>
            <p className="text-on-surface-variant" style={{ fontSize:13 }}>{email||"example@email.com"}</p>
          </div>
          <button className="btn-primary w-full mb-3" onClick={() => onSwitchTab("login")}>ĐĂNG NHẬP NGAY →</button>
        </div>
      )}
    </div>
  );
}

function OtpBoxes({ onChange }: { onChange: (otp: string) => void }) {
  const collect = () => {
    const boxes = document.querySelectorAll<HTMLInputElement>(".otp-box");
    const value = Array.from(boxes).map((b) => b.value).join("");
    onChange(value);
  };
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    collect();
    if (e.target.value.length === 1) {
      const next = document.querySelectorAll<HTMLInputElement>(".otp-box")[i + 1];
      if (next) next.focus();
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      const prev = document.querySelectorAll<HTMLInputElement>(".otp-box")[i - 1];
      if (prev) prev.focus();
    }
  };
  return (
    <div className="flex gap-2 mb-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} className="otp-box" maxLength={1} type="text" inputMode="numeric"
          onChange={(e) => handleInput(e, i)} onKeyDown={(e) => handleKeyDown(e, i)} />
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
