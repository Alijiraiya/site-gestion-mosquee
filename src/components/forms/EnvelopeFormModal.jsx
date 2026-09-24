"use client";
import { useState } from "react";
import { Modal, Field, useToast } from "@/components/ui";
import { SelectLite } from "@/components/SelectLite";
import { api } from "@/lib/apiClient";
import {
  ENVELOPE_CATEGORIES,
  ENVELOPE_PERIODS,
  CATEGORY_METADATA,
  PERIOD_METADATA,
} from "@/lib/envelopes";
import { useTranslations, useLocale } from "next-intl";

const COLOR_OPTIONS = [
  { label: "Bleu", value: "#3b82f6" },
  { label: "Émeraude", value: "#10b981" },
  { label: "Ambre", value: "#f59e0b" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#ec4899" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Gris", value: "#6b7280" },
];

export default function EnvelopeFormModal({ envelope, onClose, onSaved }) {
  const toast = useToast();
  const t = useTranslations("Envelopes");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const isAr = locale === "ar";

  const isEdit = Boolean(envelope?.id);
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(envelope?.name || "");
  const [category, setCategory] = useState(envelope?.category || "UTILITIES");
  const [periodType, setPeriodType] = useState(envelope?.periodType || "ANNUAL");
  const [allocatedAmount, setAllocatedAmount] = useState(
    envelope?.allocatedAmount ? String(envelope.allocatedAmount) : ""
  );
  const [alertThreshold, setAlertThreshold] = useState(
    envelope?.alertThreshold !== undefined ? Number(envelope.alertThreshold) : 80
  );
  const [startDate, setStartDate] = useState(
    envelope?.startDate
      ? new Date(envelope.startDate).toISOString().slice(0, 10)
      : `${currentYear}-01-01`
  );
  const [endDate, setEndDate] = useState(
    envelope?.endDate
      ? new Date(envelope.endDate).toISOString().slice(0, 10)
      : `${currentYear}-12-31`
  );
  const [description, setDescription] = useState(envelope?.description || "");
  const [color, setColor] = useState(
    envelope?.color || CATEGORY_METADATA[envelope?.category || "UTILITIES"]?.color || "#3b82f6"
  );
  const [status, setStatus] = useState(envelope?.status || "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  // Auto-adjust dates when changing periodType if creating new
  function handlePeriodChange(newPeriod) {
    setPeriodType(newPeriod);
    if (!isEdit) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      if (newPeriod === "MONTHLY") {
        setStartDate(`${y}-${m}-01`);
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        setEndDate(`${y}-${m}-${lastDay}`);
      } else if (newPeriod === "ANNUAL") {
        setStartDate(`${y}-01-01`);
        setEndDate(`${y}-12-31`);
      }
    }
  }

  // Auto-set matching category color if user hasn't explicitly customized
  function handleCategoryChange(newCat) {
    setCategory(newCat);
    if (CATEGORY_METADATA[newCat]?.color) {
      setColor(CATEGORY_METADATA[newCat].color);
    }
  }

  async function submit() {
    setErrors({});
    const errs = {};

    if (!name.trim()) {
      errs.name = isAr ? "اسم الظرف المالي مطلوب." : "Le nom de l'enveloppe est requis.";
    }

    const alloc = Number(allocatedAmount);
    if (!alloc || alloc <= 0) {
      errs.allocatedAmount = isAr
        ? "المبلغ المخصص يجب أن يكون رقمًا أكبر من الصفر."
        : "Le montant alloué doit être supérieur à 0.";
    }

    if (!startDate) {
      errs.startDate = isAr ? "تاريخ البداية مطلوب." : "La date de début est requise.";
    }
    if (!endDate) {
      errs.endDate = isAr ? "تاريخ النهاية مطلوب." : "La date de fin est requise.";
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errs.endDate = isAr
        ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."
        : "La date de fin doit être postérieure à la date de début.";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast(isAr ? "يرجى تصحيح الأخطاء في النموذج." : "Veuillez corriger les erreurs.", "err");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        periodType,
        allocatedAmount: alloc,
        alertThreshold: Number(alertThreshold),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        description: description.trim() || undefined,
        color,
        status,
      };

      if (isEdit) {
        await api.put(`/envelopes/${envelope.id}`, payload);
        toast(t("modal.successUpdate"));
      } else {
        await api.post("/envelopes", payload);
        toast(t("modal.successCreate"));
      }

      onSaved?.();
      onClose?.();
    } catch (e) {
      const serverMsg = e?.message || (isAr ? "حدث خطأ أثناء الحفظ." : "Échec de l'enregistrement.");
      toast(serverMsg, "err");
      if (e?.errors) {
        setErrors(e.errors);
      }
    } finally {
      setBusy(false);
    }
  }

  const categoryOptions = ENVELOPE_CATEGORIES.map((catKey) => ({
    value: catKey,
    label: isAr
      ? CATEGORY_METADATA[catKey]?.arLabel || catKey
      : CATEGORY_METADATA[catKey]?.label || catKey,
  }));

  const periodOptions = ENVELOPE_PERIODS.map((pKey) => ({
    value: pKey,
    label: isAr
      ? PERIOD_METADATA[pKey]?.arLabel || pKey
      : PERIOD_METADATA[pKey]?.label || pKey,
  }));

  return (
    <Modal
      title={isEdit ? t("modal.editTitle") : t("modal.createTitle")}
      subtitle={
        isEdit
          ? envelope.name
          : isAr
          ? "تحديد ميزانية مخصصة وضبط حدود الاستهلاك"
          : "Définir une allocation budgétaire et configurer le seuil d'alerte"
      }
      icon="envelope"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose} disabled={busy}>
            {t("modal.cancel")}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy
              ? t("modal.saving")
              : isEdit
              ? t("modal.save")
              : t("modal.create")}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("modal.nameLabel")} required full hint={errors.name}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("modal.namePlaceholder")}
            style={errors.name ? { borderColor: "#ef4444" } : undefined}
          />
        </Field>

        <Field label={t("modal.categoryLabel")} required>
          <SelectLite
            value={category}
            onChange={handleCategoryChange}
            options={categoryOptions}
          />
        </Field>

        <Field label={t("modal.periodLabel")} required>
          <SelectLite
            value={periodType}
            onChange={handlePeriodChange}
            options={periodOptions}
          />
        </Field>

        <Field label={t("modal.allocatedLabel")} required full hint={errors.allocatedAmount}>
          <input
            type="number"
            min="1"
            step="1000"
            value={allocatedAmount}
            onChange={(e) => setAllocatedAmount(e.target.value)}
            placeholder="150000"
            style={{
              fontSize: 18,
              fontWeight: 700,
              borderColor: errors.allocatedAmount ? "#ef4444" : undefined,
            }}
          />
        </Field>

        <div className="full" style={{ padding: "8px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              {t("modal.thresholdLabel")} :{" "}
              <span
                style={{
                  color:
                    alertThreshold >= 85
                      ? "#f59e0b"
                      : alertThreshold >= 70
                      ? "#3b82f6"
                      : "#10b981",
                  fontWeight: 800,
                  fontSize: 15,
                }}
              >
                {alertThreshold}%
              </span>
            </label>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {alertThreshold >= 90
                ? isAr ? "تنبيه متأخر" : "Alerte tardive"
                : alertThreshold >= 80
                ? isAr ? "موصى به (80%)" : "Recommandé (80%)"
                : isAr ? "تنبيه مبكر" : "Alerte précoce"}
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: "#52b788",
              cursor: "pointer",
            }}
          />
          <p className="field-hint" style={{ marginTop: 4 }}>
            {t("modal.thresholdHelp")}
          </p>
        </div>

        <Field label={t("modal.startDateLabel")} required hint={errors.startDate}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={errors.startDate ? { borderColor: "#ef4444" } : undefined}
          />
        </Field>

        <Field label={t("modal.endDateLabel")} required hint={errors.endDate}>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={errors.endDate ? { borderColor: "#ef4444" } : undefined}
          />
        </Field>

        <Field label={t("modal.colorLabel")}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
            {COLOR_OPTIONS.map((col) => (
              <button
                key={col.value}
                type="button"
                onClick={() => setColor(col.value)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: col.value,
                  border: color === col.value ? "3px solid #ffffff" : "2px solid transparent",
                  boxShadow: color === col.value ? "0 0 0 2px " + col.value : "none",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                  transform: color === col.value ? "scale(1.15)" : "scale(1)",
                }}
                title={col.label}
              />
            ))}
          </div>
        </Field>

        {isEdit && (
          <Field label={t("modal.statusLabel")}>
            <SelectLite
              value={status}
              onChange={setStatus}
              options={[
                { value: "ACTIVE", label: isAr ? "نشطة" : "Active" },
                { value: "CLOSED", label: isAr ? "مغلقة" : "Clôturée" },
                { value: "DRAFT", label: isAr ? "مسودة" : "Brouillon" },
              ]}
            />
          </Field>
        )}

        <Field label={t("modal.descriptionLabel")} full>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("modal.descriptionPlaceholder")}
          />
        </Field>
      </div>
    </Modal>
  );
}
