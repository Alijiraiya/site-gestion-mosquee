"use client";
import { useState } from "react";
import { Modal } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useTranslations } from "next-intl";

// Same red as HEALTH_COLOR.bad, so destructive actions look consistent.
const DANGER = "#e9806a";

/**
 * Generic confirmation popup for destructive actions: one click must never be
 * enough to erase a file.
 *
 * The optional secondary action lets the same dialog offer the safe
 * alternative (archive = keep the history) next to the destructive one.
 */
export default function ConfirmDialog({
  title,
  subtitle,
  message,
  warning,
  confirmLabel,
  secondaryLabel,
  onConfirm,
  onSecondary,
  onClose,
  icon = "alert",
}) {
  const t = useTranslations("App");
  const [busy, setBusy] = useState(false);

  // Both buttons stay disabled while a request is in flight, so a double click
  // can never fire two deletions.
  const run = (fn) => async () => {
    if (!fn || busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={icon}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose} disabled={busy}>
            {t("Annuler")}
          </button>
          {secondaryLabel && (
            <button
              className="btn btn-ghost"
              onClick={run(onSecondary)}
              disabled={busy}
            >
              <Icon name="archive" size={16} /> {secondaryLabel}
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ background: DANGER, color: "#2a0d07", boxShadow: "none" }}
            onClick={run(onConfirm)}
            disabled={busy}
          >
            <Icon name="trash" size={16} />{" "}
            {busy ? t("Suppression\u2026") : confirmLabel}
          </button>
        </>
      }
    >
      <div
        className="fd-todo"
        role="alert"
        style={{
          marginBottom: 0,
          background: "rgba(233, 128, 106, 0.14)",
          border: "1px solid rgba(233, 128, 106, 0.42)",
        }}
      >
        <Icon name="alert" size={16} style={{ color: DANGER }} />
        <div>
          <b>{message}</b>
          {warning && <div className="fd-todo-sub">{warning}</div>}
        </div>
      </div>
    </Modal>
  );
}
