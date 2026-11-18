"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth.service";
import { ROLE_REDIRECTS, setSessionClient, type AuthUser, type UserRole } from "@/lib/auth";
import type { User } from "@/lib/types";

function toSessionUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role as UserRole,
    branchId: user.branchId ?? undefined,
    branchCode: user.branchCode ?? undefined,
    phone: user.phone ?? undefined,
    avatar: user.avatarUrl ?? undefined,
    notificationEnabled: user.notificationEnabled,
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập Google...");

  useEffect(() => {
    let active = true;

    async function syncGoogleSession() {
      try {
        const user = await authService.getMe();
        if (!active) return;

        const sessionUser = toSessionUser(user);
        setSessionClient(sessionUser);
        router.replace(ROLE_REDIRECTS[sessionUser.role] ?? "/customer");
      } catch (error) {
        console.error(error);
        if (!active) return;
        setMessage("Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.");
      }
    }

    void syncGoogleSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center shadow-sm">
        <p className="font-headline-sm text-headline-sm text-primary mb-3">AuraSpa</p>
        <p className="text-on-surface-variant">{message}</p>
        {message.includes("Không thể") && (
          <Link href="/login" className="btn-primary mt-6 inline-flex">
            Quay lại đăng nhập
          </Link>
        )}
      </div>
    </main>
  );
}
