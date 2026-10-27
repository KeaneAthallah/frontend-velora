"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./primitives";

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

// Modals can open over another modal (a confirmation over a detail sheet, for
// example). Keep a stack so only the top layer handles Escape and Tab, and the
// layer underneath is hidden from assistive technology.
const modalStack: string[] = [];
const modalListeners = new Set<() => void>();

function emitModalChange() {
  modalListeners.forEach((listener) => listener());
}

function subscribeModalStack(listener: () => void) {
  modalListeners.add(listener);
  return () => modalListeners.delete(listener);
}

function isTopModal(id: string) {
  return modalStack.length === 0 || modalStack[modalStack.length - 1] === id;
}

function useIsTopModal(id: string) {
  return React.useSyncExternalStore(
    subscribeModalStack,
    () => !modalStack.includes(id) || isTopModal(id),
    () => true
  );
}

function useModalStack(id: string, open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    modalStack.push(id);
    emitModalChange();
    return () => {
      const index = modalStack.lastIndexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
      emitModalChange();
    };
  }, [id, open]);
}

function useModalBehavior(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<HTMLElement | null>,
  id: string
) {
  const isTop = useIsTopModal(id);
  useModalStack(id, open);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      if (!isTopModal(id)) return;
      const focusable = ref.current?.querySelector<HTMLElement>(
        '[autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? ref.current)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(id)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const nodes = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open, onClose, ref, id]);

  return isTop;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
  closeOnOverlayClick = true,
  bodyClassName,
  className,
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  closeOnOverlayClick?: boolean;
  bodyClassName?: string;
  className?: string;
  hideClose?: boolean;
}) {
  const mounted = useMounted();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const isTop = useModalBehavior(open, onClose, panelRef, id);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="overlay"
      aria-hidden={isTop ? undefined : true}
      inert={isTop ? undefined : true}
      onMouseDown={(event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn("dialog", className)}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        style={{ ["--dialog-w" as string]: `${width}px` }}
      >
        <div className="dialog__head">
          <div className="dialog__head-copy">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {!hideClose && (
            <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={cn("dialog__body", bodyClassName)}>{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const mounted = useMounted();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const isTop = useModalBehavior(open, onClose, panelRef, id);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="sheet-overlay"
      aria-hidden={isTop ? undefined : true}
      inert={isTop ? undefined : true}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        style={{ ["--sheet-w" as string]: `${width}px` }}
      >
        <div className="sheet__head">
          <div className="dialog__head-copy">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={430}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13, lineHeight: 1.55, color: "hsl(var(--ink-2))" }}>{description}</p>
    </Dialog>
  );
}
