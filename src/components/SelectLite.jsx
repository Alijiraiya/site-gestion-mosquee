"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/**
 * Drop-in replacement for a native <select className="select-lite">.
 * options: [{ value, label }]
 */
export function SelectLite({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  placeholder = "",
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  // Flip the menu above the trigger when there isn't enough room below in
  // the viewport (e.g. the last field in a modal, close to the bottom of a
  // small screen) so the last option is never pushed out of view.
  function toggleOpen() {
    if (disabled) return;
    if (!open && boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      const estimatedMenuHeight = Math.min(options.length * 40 + 16, 280);
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight);
    }
    setOpen((o) => !o);
  }

  return (
    <div
      className={`select-lite-wrap ${disabled ? "disabled" : ""} ${className}`}
      ref={boxRef}
    >
      <button
        type="button"
        className="select-lite-trigger"
        disabled={disabled}
        onClick={toggleOpen}
      >
        <span>{current?.label || placeholder}</span>
        <Icon name="chevronDown" size={14} />
      </button>

      {open && !disabled && (
        <div className={`select-lite-menu ${openUp ? "up" : ""}`}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`select-lite-opt ${opt.value === value ? "on" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}