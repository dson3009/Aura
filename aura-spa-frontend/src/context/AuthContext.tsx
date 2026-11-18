"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  AuthUser,
  UserRole,
  AUTH_SESSION_EVENT,
  ROLE_REDIRECTS,
  MOCK_USERS,
  getSessionClient,
  setSessionClient,
  clearSessionClient,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import { authService } from "@/lib/services/auth.service";
import type { User } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LoginResult {
  success: boolean;
  error?: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<LoginResult>;
  logout: () => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track failed login attempts per email: { [email]: count }
  const [failCounts, setFailCounts] = useState<Record<string, number>>({});
  // Lock timestamps: { [email]: unlockTime }
  const [lockUntil, setLockUntil] = useState<Record<string, number>>({});

  const router = useRouter();

  // Rehydrate session on mount
  useEffect(() => {
    const syncSession = () => {
      setUser(getSessionClient());
      setIsLoading(false);
    };

    syncSession();
    window.addEventListener(AUTH_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      // Input validation
      const emailErr = validateEmail(email);
      if (emailErr) return { success: false, error: emailErr };
      if (!password) return { success: false, error: "Vui lòng nhập mật khẩu." };

      const normalizedEmail = email.trim().toLowerCase();

      // Check if locked (UC-02 E1: 5 attempts → 30 min lock)
      const now = Date.now();
      const unlockAt = lockUntil[normalizedEmail] ?? 0;
      if (unlockAt > now) {
        const mins = Math.ceil((unlockAt - now) / 60000);
        return {
          success: false,
          error: `Tài khoản bị khóa. Vui lòng thử lại sau ${mins} phút.`,
        };
      }

      try {
        const res = await authService.login(normalizedEmail, password);
        // Save token and set session
        localStorage.setItem("accessToken", res.accessToken);
        
        const userObj = res.user as User & { branchId?: string; branchCode?: string };
        const sessionUser: AuthUser = {
          id: res.user.id,
          name: res.user.fullName,
          email: res.user.email,
          role: res.user.role as UserRole,
          branchId: userObj.branchId,
          branchCode: userObj.branchCode,
          phone: res.user.phone ?? undefined,
          avatar: res.user.avatarUrl ?? undefined,
        };

        setUser(sessionUser);
        setSessionClient(sessionUser);
        
        // Reset fail count on success
        setFailCounts((prev) => ({ ...prev, [normalizedEmail]: 0 }));

        router.push(ROLE_REDIRECTS[sessionUser.role]);
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "";
        
        // Check if this error is an API response indicating wrong password/email (401)
        // or a network error.
        const isConnectionError = errorMessage.toLowerCase().includes("failed to fetch") || 
                                 errorMessage.toLowerCase().includes("networkerror") ||
                                 errorMessage.toLowerCase().includes("load");
                                 
        if (!isConnectionError) {
          // Authentic rejection from backend (wrong credentials)
          const newCount = (failCounts[normalizedEmail] ?? 0) + 1;
          setFailCounts((prev) => ({ ...prev, [normalizedEmail]: newCount }));

          if (newCount >= 5) {
            const lockTime = Date.now() + 30 * 60 * 1000;
            setLockUntil((prev) => ({ ...prev, [normalizedEmail]: lockTime }));
            setFailCounts((prev) => ({ ...prev, [normalizedEmail]: 0 }));
            return {
              success: false,
              error: "Sai thông tin đăng nhập quá 5 lần. Tài khoản bị khóa 30 phút.",
            };
          }

          return {
            success: false,
            error: `Email hoặc mật khẩu không đúng. (${newCount}/5 lần)`,
          };
        }
        
        // Offline Fallback Mode: check Mock database
        const found = MOCK_USERS.find(
          (u) =>
            u.email.toLowerCase() === normalizedEmail && u.password === password
        );

        if (!found) {
          const newCount = (failCounts[normalizedEmail] ?? 0) + 1;
          setFailCounts((prev) => ({ ...prev, [normalizedEmail]: newCount }));

          if (newCount >= 5) {
            const lockTime = Date.now() + 30 * 60 * 1000;
            setLockUntil((prev) => ({ ...prev, [normalizedEmail]: lockTime }));
            setFailCounts((prev) => ({ ...prev, [normalizedEmail]: 0 }));
            return {
              success: false,
              error: "Sai thông tin đăng nhập quá 5 lần. Tài khoản bị khóa 30 phút.",
            };
          }

          return {
            success: false,
            error: `Email hoặc mật khẩu không đúng. (${newCount}/5 lần) [Offline Mode]`,
          };
        }

        // Reset fail count on success
        setFailCounts((prev) => ({ ...prev, [normalizedEmail]: 0 }));

        const sessionUser: AuthUser = {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role as UserRole,
          branchId: found.branchId,
          avatar: found.avatar,
        };

        setUser(sessionUser);
        setSessionClient(sessionUser);

        router.push(ROLE_REDIRECTS[sessionUser.role]);
        return { success: true };
      }
    },
    [router, failCounts, lockUntil]
  );

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(
    async (data: RegisterData): Promise<LoginResult> => {
      try {
        const payload = {
          fullName: `${data.lastName} ${data.firstName}`.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone,
          password: data.password,
          dateOfBirth: data.dob || undefined,
        };
        await authService.register(payload);
        
        // Auto-login on success
        return login(data.email, data.password);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "";
        const isConnectionError = errorMessage.toLowerCase().includes("failed to fetch") || 
                                 errorMessage.toLowerCase().includes("networkerror") ||
                                 errorMessage.toLowerCase().includes("load");
                                 
        if (!isConnectionError) {
          return { success: false, error: errorMessage };
        }
        
        // Offline Fallback Mode
        const normalizedEmail = data.email.trim().toLowerCase();
        const exists = MOCK_USERS.find(
          (u) => u.email.toLowerCase() === normalizedEmail
        );
        if (exists) {
          return {
            success: false,
            error: "Email đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác. [Offline Mode]",
          };
        }

        const newUser: AuthUser = {
          id: `c${Date.now()}`,
          name: `${data.lastName} ${data.firstName}`.trim(),
          email: normalizedEmail,
          role: "customer",
        };

        MOCK_USERS.push({ ...newUser, password: data.password });
        setUser(newUser);
        setSessionClient(newUser);
        return { success: true };
      }
    },
    [login]
  );

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    try {
      void authService.logout();
    } catch (err) {
      console.error("Logout API error:", err);
    }
    localStorage.removeItem("accessToken");
    setUser(null);
    clearSessionClient();
    router.push("/login");
  }, [router]);

  // ── Update profile ────────────────────────────────────────────────────────
  const updateProfile = useCallback(
    (updates: Partial<AuthUser>) => {
      if (!user) return;
      const updated = { ...user, ...updates };
      setUser(updated);
      setSessionClient(updated);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
