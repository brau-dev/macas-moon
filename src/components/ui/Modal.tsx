"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  size?: "md" | "lg" | "full";
};

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  headerClassName,
  bodyClassName,
  size = "lg",
}: ModalProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function getFocusable() {
      if (!dialogRef.current) return [];
      return Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getAttribute("aria-hidden") !== "true",
      );
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("Cerrar")}
        className="absolute inset-0 bg-ink/45 transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[92svh] w-full flex-col overflow-hidden bg-warm-white shadow-soft duration-300",
          size === "full" && "h-[100svh] max-h-[100svh] rounded-none sm:h-auto sm:max-h-[92svh] sm:rounded-[24px]",
          size === "lg" && "rounded-t-[24px] sm:max-w-4xl sm:rounded-[24px]",
          size === "md" && "rounded-t-[24px] sm:max-w-xl sm:rounded-[24px]",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4 sm:px-8",
            headerClassName,
          )}
        >
          <h2 id={titleId} className="heading-card text-2xl text-ink">
            {t(title)}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-sand-100"
            aria-label={t("Cerrar modal")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn(
            "overflow-y-auto px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-8",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
