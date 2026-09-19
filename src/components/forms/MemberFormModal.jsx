"use client";
import { useState } from "react";
import { Modal, Field, useToast } from "@/components/ui";
import { api } from "@/lib/apiClient";
import { MEMBER_ROLES } from "@/lib/format";
import { SelectLite } from "@/components/SelectLite";
import { useTranslations } from "next-intl";

// Roles that always carry the family head's surname. For these the "Nom" field
// is filled from the head and locked, so the user only types the first name.
const INHERITS_FAMILY_NAME = ["HEAD", "CHILD"];

// The head of family is created with the family itself and there can only ever
// be one, so HEAD is never offered when adding a member.
const SELECTABLE_ROLES = MEMBER_ROLES.filter((m) => m.value !== "HEAD");

const EMPTY = {
  firstName: "",
  lastName: "",
  role: "CHILD",
  dob: "",
  occupation: "",
  monthlyIncome: "",
  health: "good",
  diseases: "",
};

export default function MemberFormModal({
  familyId,
  familyName,
  familyLastName,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const t = useTranslations("App");
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setV = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  // Fall back to the last word of the displayed family name when the surname
  // was not passed explicitly (older call sites only provide "Prenom Nom").
  const headLastName = (
    familyLastName ||
    familyName?.trim().split(/\s+/).slice(-1)[0] ||
    ""
  ).trim();
  const inheritsName = INHERITS_FAMILY_NAME.includes(f.role);
  // The locked field shows the head's surname; other roles keep their own.
  const lastName = inheritsName ? headLastName : f.lastName;

  async function submit() {
    if (!f.firstName || !f.role) {
      toast(t("Le pr\u00e9nom et le r\u00f4le sont obligatoires"), "err");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/families/${familyId}/members`, {
        firstName: f.firstName,
        lastName: lastName || undefined,
        role: f.role,
        dateOfBirth: f.dob || undefined,
        occupation: f.occupation || undefined,
        monthlyIncome: f.monthlyIncome ? Number(f.monthlyIncome) : undefined,
        hasDisability: f.health === "bad",
        diseases:
          f.health === "warn" ? f.diseases || "Maladie chronique" : undefined,
      });
      toast(t("Membre ajout\u00e9 avec succ\u00e8s"));
      // Registering a spouse for a "Célibataire" head makes the household
      // married: the API corrects the status, so say it out loud instead of
      // letting the imam discover it in the table.
      if (res?.maritalStatusChanged) {
        toast(
          `${t("Situation familiale mise \u00e0 jour")}: ${t("Mari\u00e9(e)")}`,
        );
      }
      onSaved?.(res);
      onClose?.();
    } catch (e) {
      toast(e.message || t("\u00c9chec de l'enregistrement"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("Ajouter un membre")}
      subtitle={
        familyName
          ? `${t("Famille")} ${familyName}`
          : t("Nouveau membre de la famille")
      }
      icon="users"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose} disabled={busy}>
            {t("Annuler")}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t("Enregistrement\u2026") : t("Ajouter le membre")}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("Pr\u00e9nom")} required>
          <input
            value={f.firstName}
            onChange={set("firstName")}
            placeholder="Youcef"
          />
        </Field>
        <Field
          label={t("Nom")}
          hint={
            inheritsName && headLastName
              ? t("Repris automatiquement du chef de famille")
              : undefined
          }
        >
          <input
            value={lastName}
            onChange={set("lastName")}
            disabled={inheritsName}
            placeholder={
              inheritsName ? t("Nom du chef de famille") : "Benali"
            }
          />
        </Field>
        <Field
          label={t("R\u00f4le")}
          required
          hint={
            f.role === "SPOUSE"
              ? t("La situation familiale passera \u00e0 Mari\u00e9(e)")
              : undefined
          }
        >
          <SelectLite
            value={f.role}
            onChange={setV("role")}
            options={SELECTABLE_ROLES.map((m) => ({
              value: m.value,
              label: t(m.label),
            }))}
          />
        </Field>
        <Field label={t("Date de naissance")}>
          <input type="date" value={f.dob} onChange={set("dob")} />
        </Field>
        <Field label={t("Occupation")}>
          <input
            value={f.occupation}
            onChange={set("occupation")}
            placeholder={t("\u00c9tudiant, ouvrier\u2026")}
          />
        </Field>
        <Field label={t("Revenu mensuel (DA)")}>
          <input
            type="number"
            min="0"
            value={f.monthlyIncome}
            onChange={set("monthlyIncome")}
            placeholder="0"
          />
        </Field>
        <Field label={t("\u00c9tat de sant\u00e9")}>
          <SelectLite
            value={f.health}
            onChange={setV("health")}
            options={[
              { value: "good", label: t("Bonne") },
              { value: "warn", label: t("Maladie chronique") },
              { value: "bad", label: t("Handicap") },
            ]}
          />
        </Field>
        {f.health === "warn" && (
          <Field label={t("Pr\u00e9cisez la maladie")}>
            <input
              value={f.diseases}
              onChange={set("diseases")}
              placeholder={t("Diab\u00e8te\u2026")}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}