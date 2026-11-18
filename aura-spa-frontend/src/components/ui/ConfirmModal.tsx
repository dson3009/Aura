"use client";
import type { ReactNode } from "react";

type ConfirmModalProps = Readonly<{
  open: boolean;
  icon: string;
  title: string;
  description?: string;
  bullets?: ReactNode[];
  confirmLabel: string;
  variant?: "danger" | "warning";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>;

export default function ConfirmModal({
  open,
  icon,
  title,
  description,
  bullets,
  confirmLabel,
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isDanger ? "bg-error-container" : "bg-amber-100"
          }`}>
            <span
              className={`material-symbols-outlined ${isDanger ? "text-error" : "text-amber-600"}`}
              style={{ fontSize: 20 }}
            >
              {icon}
            </span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</h2>
            {description && (
              <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {bullets && bullets.length > 0 && (
          <ul className="space-y-2 mb-5 text-sm">
            {bullets.map((b, i) => (
              <li key={`bullet-${i}`} className="flex items-start gap-2 text-on-surface">
                <span
                  className={`material-symbols-outlined shrink-0 ${isDanger ? "text-error" : "text-amber-600"}`}
                  style={{ fontSize: 16, marginTop: 2 }}
                >
                  arrow_right
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-3 rounded-full font-label-md text-label-md hover:opacity-90 font-bold disabled:opacity-50 text-sm ${
              isDanger ? "bg-error text-on-error" : "bg-amber-500 text-white"
            }`}
          >
            {isLoading ? "Đang xử lý..." : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border border-outline-variant py-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container disabled:opacity-50 text-sm"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}
