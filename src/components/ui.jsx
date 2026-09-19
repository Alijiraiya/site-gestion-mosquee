"use client";
import { createContext, useCallback, useContext, useState, useEffect, useRef } from "react";
import { Icon } from "./icons";

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export function useToast() {
  return useContext(ToastCtx);
}
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, subtitle, icon = "plus", onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-accent" />
        <div className="modal-head">
          <div className="m-ico">
            <Icon name={icon} size={20} />
          </div>
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, required, full, children, hint }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      {label && (
        <label>
          {label} {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({ icon, iconColor, iconBg, label, value, badge, badgeType = "up" }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <div className="stat-ico" style={{ background: iconBg, color: iconColor }}>
          <Icon name={icon} size={20} />
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value">{value}</div>
      {badge && (
        <div className={`stat-trend ${badgeType}`}>
          <Icon
            name={badgeType === "up" ? "trendUp" : badgeType === "down" ? "trendDown" : "dot"}
            size={13}
          />
          {badge}
        </div>
      )}
    </div>
  );
}

/* ---------- Autocomplete ---------- */
export function Autocomplete({ placeholder, items, value, onChange, onSelect, renderItem }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="ac" ref={boxRef}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHl(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") setHl((h) => Math.min(h + 1, items.length - 1));
          if (e.key === "ArrowUp") setHl((h) => Math.max(h - 1, 0));
          if (e.key === "Enter" && items[hl]) {
            e.preventDefault();
            onSelect(items[hl]);
            setOpen(false);
          }
        }}
      />
      {open && items.length > 0 && (
        <div className="ac-list">
          {items.map((it, i) => (
            <div
              key={it.id || i}
              className={`ac-item ${i === hl ? "hl" : ""}`}
              onMouseEnter={() => setHl(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(it);
                setOpen(false);
              }}
            >
              {renderItem(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Loading / empty / error states ---------- */
export function Loading({ label = "Chargement\u2026" }) {
  return (
    <div className="state">
      <div className="spinner" />
      {label}
    </div>
  );
}
export function EmptyState({ label }) {
  return <div className="state">{label}</div>;
}
export function ErrorState({ label }) {
  return <div className="state" style={{ color: "#e9806a" }}>{label}</div>;
}
