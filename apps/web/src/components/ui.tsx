"use client";

import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import type { Pagination } from "@/lib/api";
import { statusLabel } from "@/lib/format";

export type IconName =
  | "overview"
  | "invoice"
  | "clients"
  | "payment"
  | "team"
  | "settings"
  | "plus"
  | "arrow"
  | "back"
  | "search"
  | "close"
  | "menu"
  | "logout"
  | "check"
  | "wallet"
  | "copy"
  | "link"
  | "trash"
  | "refresh";

const paths: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),

  invoice: (
    <>
      <path d="M6 3h9l4 4v14l-4-2-3 2-3-2-3 2V3Z" />
      <path d="M14 3v5h5M9 12h7M9 16h4" />
    </>
  ),

  clients: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
    </>
  ),

  payment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),

  team: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21v-3a6 6 0 0 1 12 0v3M3 7v4M1 9h4M20 7v4M18 9h4" />
    </>
  ),

  settings: (
    <>
      <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3H9Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  back: <path d="M20 12H5m6-6-6 6 6 6" />,

  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),

  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  logout: <path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4" />,
  check: <path d="m5 12 4 4L19 6" />,

  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 8V5l14-3v3M16 11h5v5h-5z" />
    </>
  ),

  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),

  link: (
    <path d="m10 7 3-3a5 5 0 0 1 7 7l-3 3M14 17l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8" />
  ),

  trash: <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />,

  refresh: <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/dashboard" className="brand" aria-label="PayBridge home">
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      PayBridge
    </Link>
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Loading({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
  icon = "invoice",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state">
      <Alert>{error}</Alert>
      {retry && (
        <button className="button secondary" onClick={retry}>
          <Icon name="refresh" />
          Try again
        </button>
      )}
    </div>
  );
}

export function PaginationControls({
  pagination,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {pagination.total} record
        {pagination.total !== 1 ? "s" : ""} · Page {pagination.page} of{" "}
        {Math.max(1, pagination.totalPages)}
      </span>

      <div>
        <button
          className="button secondary small"
          disabled={!pagination.hasPreviousPage}
          onClick={() => onPage(pagination.page - 1)}
        >
          Previous
        </button>

        <button
          className="button secondary small"
          disabled={!pagination.hasNextPage}
          onClick={() => onPage(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();

  const control =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
      ? (children as ReactElement<{
          id?: string;
          "aria-describedby"?: string;
        }>)
      : null;

  const id = control?.props.id || generatedId;

  return (
    <div className="field">
      {control ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}

      {control
        ? cloneElement(control, {
            id,
            ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
          })
        : children}

      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

export function Confirm({
  title,
  description,
  actionLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  actionLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>

      <div className="form-actions">
        <button
          className="button secondary"
          onClick={onClose}
          disabled={busy}
          autoFocus
        >
          Keep as is
        </button>

        <button className="button danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : actionLabel}
        </button>
      </div>
    </dialog>
  );
}

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");

  return (
    <button
      className="button secondary small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setMessage("Copied");
        } catch {
          setMessage("Select and copy the text");
        }
      }}
    >
      <Icon name="copy" />
      {message || label}
    </button>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="back-link" href={href}>
      <Icon name="back" size={16} />
      {children}
    </Link>
  );
}
