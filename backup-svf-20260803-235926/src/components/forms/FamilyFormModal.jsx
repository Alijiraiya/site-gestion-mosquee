"use client";
import { useState } from "react";
import { Modal, Field, useToast } from "@/components/ui";
import { api } from "@/lib/apiClient";
import { MARITAL_STATUS, HOUSING_STATUS, HOUSING_TYPE } from "@/lib/format";
import { useTranslations } from "next-intl";

// Marital statuses for which there is no spouse -> the Conjoint(e) field is
// disabled and cleared (only MARRIED keeps it active).
const NO_SPOUSE = ["SINGLE", "WIDOWED", "DIVORCED"];

// Housing rules: "Sans domicile" (HOMELESS) has no housing type; every other
// status offers Maison / Appartement / Autre (the "Temporaire" type is dropped
// since it now exists as a housing STATUS).
const HOMELESS = "HOMELESS";
const HOUSING_TYPE_OPTIONS = HOUSING_TYPE.filter(
  (h) => h.value !== "TEMPORARY",
);

const EMPTY = {
  firstName: "",
  lastName: "",
  dob: "",
  ccp: "",
  phone: "",
  wilaya: "",
  address: "",
  maritalStatus: "MARRIED",
  spouseName: "",
  // Default status is MARRIED, and a married head always has at least the
  // spouse in the household, so the count starts at 1 rather than empty.
  membersCount: "1",
  childrenSchoolCount: "",
  orphanCount: "",
  elderlyCount: "",
  monthlyIncome: "",
  housingStatus: "TENANT",
  housingType: "APARTMENT",
  health: "good",
  diseases: "",
  notes: "",
};

export default function FamilyFormModal({ onClose, onSaved }) {
  const toast = useToast();
  const t = useTranslations("App");
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const spouseDisabled = NO_SPOUSE.includes(f.maritalStatus);
  // A married head always lives with at least the spouse, so the declared
  // household size can never be 0 (or empty) in that case.
  const isMarried = f.maritalStatus === "MARRIED";
  const minMembers = isMarried ? 1 : 0;
  const noHousing = f.housingStatus === HOMELESS;

  // Changing housing status: "Sans domicile" clears the type; switching back to
  // a housed status restores a valid default when needed.
  const onHousingStatusChange = (e) => {
    const housingStatus = e.target.value;
    setF((x) => ({
      ...x,
      housingStatus,
      housingType:
        housingStatus === HOMELESS
          ? ""
          : x.housingType && x.housingType !== "TEMPORARY"
            ? x.housingType
            : "HOUSE",
    }));
  };

  // A married head can never declare a household smaller than 1, so an empty
  // or below-minimum value is pulled back up when the field loses focus.
  const clampMembers = () =>
    setF((x) => ({
      ...x,
      membersCount:
        isMarried && (x.membersCount === "" || Number(x.membersCount) < 1)
          ? "1"
          : x.membersCount,
    }));

  // Changing marital status: when the new status has no spouse, clear the name.
  const onMaritalChange = (e) => {
    const maritalStatus = e.target.value;
    setF((x) => ({
      ...x,
      maritalStatus,
      spouseName: NO_SPOUSE.includes(maritalStatus) ? "" : x.spouseName,
      membersCount:
        maritalStatus === "MARRIED" &&
        (x.membersCount === "" || Number(x.membersCount) < 1)
          ? "1"
          : x.membersCount,
    }));
  };

  async function submit() {
    if (!f.firstName || !f.lastName || !f.dob || !f.ccp || !f.wilaya) {
      toast(t("Veuillez remplir les champs obligatoires"), "err");
      return;
    }
    setBusy(true);
    try {
      const spouse = spouseDisabled ? "" : f.spouseName;
      // Guard the same rule on submit, in case the field was never blurred.
      const membersCount =
        isMarried && (f.membersCount === "" || Number(f.membersCount) < 1)
          ? "1"
          : f.membersCount;
      const extraNotes = [
        spouse ? `Conjoint(e): ${spouse}` : "",
        membersCount ? `Membres d\u00e9clar\u00e9s: ${membersCount}` : "",
        f.notes,
      ]
        .filter(Boolean)
        .join(" \u2014 ");

      const payload = {
        firstName: f.firstName,
        lastName: f.lastName,
        dateOfBirth: f.dob,
        ccp: f.ccp,
        phone: f.phone || undefined,
        wilaya: f.wilaya,
        address: f.address || f.wilaya,
        maritalStatus: f.maritalStatus,
        housingStatus: f.housingStatus,
        housingType: noHousing ? undefined : f.housingType,
        monthlyIncome: f.monthlyIncome ? Number(f.monthlyIncome) : undefined,
        childrenSchoolCount: f.childrenSchoolCount
          ? Number(f.childrenSchoolCount)
          : undefined,
        orphanCount: f.orphanCount ? Number(f.orphanCount) : undefined,
        elderlyCount: f.elderlyCount ? Number(f.elderlyCount) : undefined,
        hasDisability: f.health === "bad",
        diseases:
          f.health === "warn" ? f.diseases || "Maladie chronique" : undefined,
        notes: extraNotes || undefined,
      };
      await api.post("/families", payload);
      toast(t("Famille ajout\u00e9e avec succ\u00e8s"));
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast(e.message || t("\u00c9chec de l'enregistrement"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("Ajouter une famille")}
      subtitle={t("Enregistrer une nouvelle famille b\u00e9n\u00e9ficiaire")}
      icon="families"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose} disabled={busy}>
            {t("Annuler")}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t("Enregistrement\u2026") : t("Enregistrer la famille")}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("Pr\u00e9nom")} required>
          <input
            value={f.firstName}
            onChange={set("firstName")}
            placeholder="Ahmed"
          />
        </Field>
        <Field label={t("Nom")} required>
          <input
            value={f.lastName}
            onChange={set("lastName")}
            placeholder="Benali"
          />
        </Field>
        <Field label={t("Date de naissance du chef")} required>
          <input type="date" value={f.dob} onChange={set("dob")} />
        </Field>
        <Field label={t("T\u00e9l\u00e9phone")}>
          <input
            value={f.phone}
            onChange={set("phone")}
            placeholder="0555 12 34 56"
          />
        </Field>
        <Field label={t("Situation familiale")}>
          <select value={f.maritalStatus} onChange={onMaritalChange}>
            {MARITAL_STATUS.map((m) => (
              <option key={m.value} value={m.value}>
                {t(m.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Conjoint(e)")}>
          <input
            value={spouseDisabled ? "" : f.spouseName}
            onChange={set("spouseName")}
            disabled={spouseDisabled}
            placeholder={
              spouseDisabled ? t("Non applicable") : t("Nom du conjoint")
            }
          />
        </Field>
        <Field label={t("Wilaya")} required>
          <input
            value={f.wilaya}
            onChange={set("wilaya")}
            placeholder="Alger"
          />
        </Field>
        <Field label={t("Commune / Adresse")}>
          <input
            value={f.address}
            onChange={set("address")}
            placeholder="Bab Ezzouar"
          />
        </Field>

        <div className="form-sep">{t("Composition & revenus")}</div>
        <Field
          label={t("Nombre de membres")}
          hint={isMarried ? t("Minimum 1 (conjoint inclus)") : undefined}
        >
          <input
            type="number"
            min={minMembers}
            value={f.membersCount}
            onChange={set("membersCount")}
            onBlur={clampMembers}
            placeholder={isMarried ? "1" : "5"}
          />
        </Field>
        <Field label={t("Enfants scolaris\u00e9s")}>
          <input
            type="number"
            min="0"
            value={f.childrenSchoolCount}
            onChange={set("childrenSchoolCount")}
            placeholder="3"
          />
        </Field>
        <Field label={t("Orphelins")}>
          <input
            type="number"
            min="0"
            value={f.orphanCount}
            onChange={set("orphanCount")}
            placeholder="0"
          />
        </Field>
        <Field label={t("Personnes \u00e2g\u00e9es")}>
          <input
            type="number"
            min="0"
            value={f.elderlyCount}
            onChange={set("elderlyCount")}
            placeholder="1"
          />
        </Field>
        <Field label={t("Revenu mensuel (DA)")}>
          <input
            type="number"
            min="0"
            value={f.monthlyIncome}
            onChange={set("monthlyIncome")}
            placeholder="25000"
          />
        </Field>
        <Field label={t("\u00c9tat de sant\u00e9")}>
          <select value={f.health} onChange={set("health")}>
            <option value="good">{t("Bonne")}</option>
            <option value="warn">{t("Maladie chronique")}</option>
            <option value="bad">{t("Handicap")}</option>
          </select>
        </Field>

        <div className="form-sep">{t("Informations administratives")}</div>
        <Field label={t("N\u00b0 CCP")} required hint={t("identifiant unique")}>
          <input
            value={f.ccp}
            onChange={set("ccp")}
            placeholder="00123456789"
          />
        </Field>
        <Field label={t("Statut du logement")}>
          <select value={f.housingStatus} onChange={onHousingStatusChange}>
            {HOUSING_STATUS.map((h) => (
              <option key={h.value} value={h.value}>
                {t(h.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Type de logement")}>
          <select
            value={noHousing ? "" : f.housingType}
            onChange={set("housingType")}
            disabled={noHousing}
          >
            {noHousing ? (
              <option value="">{t("Non applicable")}</option>
            ) : (
              HOUSING_TYPE_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {t(h.label)}
                </option>
              ))
            )}
          </select>
        </Field>
        {f.health === "warn" && (
          <Field label={t("Pr\u00e9cisez la maladie")}>
            <input
              value={f.diseases}
              onChange={set("diseases")}
              placeholder={t("Diab\u00e8te, asthme\u2026")}
            />
          </Field>
        )}
        <Field label={t("Notes")} full>
          <textarea
            rows={3}
            value={f.notes}
            onChange={set("notes")}
            placeholder={t("Informations compl\u00e9mentaires\u2026")}
          />
        </Field>
      </div>
    </Modal>
  );
}
