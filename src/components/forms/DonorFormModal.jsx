"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, Field, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, clearSession } from "@/lib/apiClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose Algerian-friendly phone check: 8-15 digits, optional leading +,
// spaces/dashes allowed while typing.
const PHONE_RE = /^\+?[0-9\s-]{8,15}$/;

// t() throws on a missing key instead of returning undefined, so a plain
// `t(key) || fallback` never reaches the fallback -- it crashes first.
// This helper checks existence before calling t().
function tOrFallback(t, key, fallback, values) {
  return t.has(key) ? t(key, values) : fallback;
}

export default function DonorFormModal({ onClose, onSaved }) {
  const t = useTranslations("Donors.form");
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState("INDIVIDUAL");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [nameExists, setNameExists] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  // Guards against a fast double-click firing two submits before the
  // disabled state re-renders.
  const inFlightRef = useRef(false);
  const nameCheckIdRef = useRef(0);

  // Debounced, non-blocking check: as the user types a name, look for an
  // existing donor with the exact same name and show an inline notice.
  // This never blocks submission by itself -- it's informational, since
  // legitimate donors can share a common name. The server's hard 409 guard
  // (name + matching phone/email) is what actually prevents true duplicates.
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameExists(false);
      return;
    }
    const requestId = ++nameCheckIdRef.current;
    const timer = setTimeout(async () => {
      setCheckingName(true);
      try {
        const data = await api.get("/donors", { search: trimmed });
        if (requestId !== nameCheckIdRef.current) return; // stale
        const match = (data.donors || []).some(
          (d) => (d.name || "").trim().toLowerCase() === trimmed.toLowerCase()
        );
        setNameExists(match);
      } catch {
        if (requestId !== nameCheckIdRef.current) return;
        setNameExists(false);
      } finally {
        if (requestId === nameCheckIdRef.current) setCheckingName(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name]);

  function validate() {
    const errs = {};
    if (!name.trim()) {
      errs.name = tOrFallback(t, "nameRequired", "Le nom est requis.");
    } else if (nameExists) {
      errs.name = tOrFallback(
        t,
        "nameExistsWarning",
        "Un donateur portant ce nom existe déjà."
      );
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      errs.email = tOrFallback(t, "emailInvalid", "Adresse email invalide.");
    }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      errs.phone = tOrFallback(t, "phoneInvalid", "Numéro de téléphone invalide.");
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (!validate()) return;

    inFlightRef.current = true;
    setSaving(true);
    try {
      await api.post("/donors", {
        donorType: type,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      toast(tOrFallback(t, "saved", "Donateur enregistré."), "ok");
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (err?.status === 401) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (err?.status === 409) {
        toast(tOrFallback(t, "duplicate", "Ce donateur existe déjà."), "err");
      } else {
        toast(err.message || tOrFallback(t, "error", "Une erreur est survenue."), "err");
      }
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }

  return (
    <Modal
      title={tOrFallback(t, "addTitle", "Ajouter un donateur")}
      icon="donors"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tOrFallback(t, "cancel", "Annuler")}
          </button>
          <button
            type="submit"
            form="donor-form"
            className="btn btn-primary"
            disabled={saving || checkingName || nameExists}
          >
            <Icon name="check" size={16} />
            {saving
              ? tOrFallback(t, "saving", "Enregistrement…")
              : tOrFallback(t, "save", "Enregistrer le donateur")}
          </button>
        </>
      }
    >
      <form id="donor-form" className="form-grid" onSubmit={submit}>
        <div className="full radio-row">
          <label className="radio-opt">
            <input
              type="radio"
              name="donorType"
              checked={type === "INDIVIDUAL"}
              onChange={() => setType("INDIVIDUAL")}
            />
            {tOrFallback(t, "individual", "Individuel")}
          </label>
          <label className="radio-opt">
            <input
              type="radio"
              name="donorType"
              checked={type === "ORGANIZATION"}
              onChange={() => setType("ORGANIZATION")}
            />
            {tOrFallback(t, "organization", "Entreprise")}
          </label>
        </div>

        <Field
          label={tOrFallback(t, "fullName", "Nom complet")}
          full
          hint={
            fieldErrors.name ||
            (nameExists
              ? tOrFallback(
                  t,
                  "nameExistsWarning",
                  "Un donateur portant ce nom existe déjà."
                )
              : checkingName
                ? tOrFallback(t, "checkingName", "Vérification…")
                : undefined)
          }
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tOrFallback(t, "fullNamePlaceholder", "Saisissez le nom")}
            style={
              fieldErrors.name || nameExists
                ? { borderColor: "var(--red)" }
                : undefined
            }
          />
        </Field>

        <Field label={tOrFallback(t, "emailLabel", "Adresse email")} hint={fieldErrors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            style={fieldErrors.email ? { borderColor: "var(--red)" } : undefined}
          />
        </Field>

        <Field label={tOrFallback(t, "phoneLabel", "Téléphone")} hint={fieldErrors.phone}>
          <div className="field-icon">
            <span className="f-ico">
              <Icon name="user" size={16} />
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={tOrFallback(t, "phonePlaceholder", "07 00 00 00 00")}
              style={fieldErrors.phone ? { borderColor: "var(--red)" } : undefined}
            />
          </div>
        </Field>

        <Field label={tOrFallback(t, "addressLabel", "Adresse")} full>
          <div className="field-icon">
            <span className="f-ico">
              <Icon name="pin" size={16} />
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={tOrFallback(t, "addressPlaceholder", "Ex. Alger — Bab Ezzouar")}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}