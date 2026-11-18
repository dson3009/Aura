import { api } from "@/lib/api";
import type { LoginResponse, User } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  loginWithGoogle: () => {
    if (typeof window !== "undefined") {
      window.location.href = `${API_URL}/auth/google`;
    }
  },

  getMe: () => api.get<User>("/auth/me"),

  updateProfile: (data: {
    fullName?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
    address?: string;
    avatarUrl?: string;
    notificationEnabled?: boolean;
    currentPassword?: string;
    password?: string;
  }) => api.patch<User>("/auth/me", data),

  logout: () => api.post("/auth/logout"),

  register: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    gender?: string;
    dateOfBirth?: string;
    address?: string;
  }) => api.post("/auth/register", data),

  verifyEmail: (email: string, otp: string) =>
    api.post("/auth/verify-email", { email, otp }),

  resendOtp: (email: string) =>
    api.post("/auth/resend-otp", { email }),

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (data: Record<string, unknown>) =>
    api.post("/auth/reset-password", data),
};
