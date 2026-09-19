"use client";
import { useState } from "react";
import { Modal, Field, useToast } from "@/components/ui";
import { api } from "@/lib/apiClient";
import { MARITAL_STATUS, HOUSING_STATUS, HOUSING_TYPE } from "@/lib/format";
import { requiresHousingType } from "@/lib/housing";
import { SelectLite } from "@/components/SelectLite";
import { useTranslations } from "next-intl";

// Marital statuses for which there is no spouse -> the Conjoint(e) field is
// disabled and cleared (only MARRIED keeps it active).
const NO_SPOUSE = ["SINGLE", "WIDOWED", "DIVORCED"];

// Housing rules: "Sans domicile" has no housing type; every other status offers
// Maison / Appartement / Autre (the "Temporaire" type is dropped since it now
// exists as a housing STATUS). Which statuses need a type is decided by
// requiresHousingType() in @/lib/housing, the same helper the API uses, so the
// form and the server can never disagree again.
const HOUSING_TYPE_OPTIONS = HOUSING_TYPE.filter(
  (h) => h.value !== "TEMPORARY",
);

// Prisma `IncomeSource` enum, in the order the imam is asked to consider them.
// This field drives the "Sans soutien" criterion of the SVF score (+20 pts),
// so it MUST be answered explicitly: an empty answer is not the same as
// declaring that the household has no income at all.
const INCOME_SOURCES = [
  { value: "SALARY", label: "Salaire" },
  { value: "PENSION", label: "Retraite / Pension" },
  { value: "SOCIAL_AID", label: "Aide sociale de l'\u00c9tat" },
  { value: "FAMILY_SUPPORT", label: "Soutien familial" },
  { value: "SMALL_BUSINESS", label: "Petit commerce" },
  { value: "CHARITY", label: "Dons / Charit\u00e9" },
  { value: "OTHER", label: "Autre source" },
];

// "Aucune source de revenu" is mutually exclusive with every other option:
// selecting it clears the rest, and selecting any other option clears it.
const NO_INCOME = { value: "NONE", label: "Aucune source de revenu" };

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
  // The declared size INCLUDES the head of family. The default status is
  // MARRIED, so the household starts at 2 (head + spouse); a non-married head
  // starts at 1 (the head alone).
  membersCount: "2",
  // Descriptive details of the family situation, kept for reporting only.
  // They are NEVER scoring inputs: the SVF children weight counts CHILD
  // FamilyMember rows exclusively, so nothing typed here moves the score.
  childrenSchoolCount: "",
  orphanCount: "",
  elderlyCount: "",
  monthlyIncome: "",
  // Deliberately empty: "not answered yet". The form refuses to submit until
  // the imam makes a choice, so no family is ever scored on a default value.
  incomeSources: [],
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
  const setV = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const spouseDisabled = NO_SPOUSE.includes(f.maritalStatus);
  // The declared size counts the head of family, so the floor is 1 for a lone
  // head and 2 for a married one (head + spouse). Both are created as real
  // FamilyMember rows on submit.
  const isMarried = f.maritalStatus === "MARRIED";
  const minMembers = isMarried ? 2 : 1;
  const noHousing = !requiresHousingType(f.housingStatus);
  const declaresNoIncome = f.incomeSources.includes(NO_INCOME.value);

  // Toggle one income source. NONE and the real sources can never coexist:
  // "no income at all" is a statement about the whole household, not one more
  // item in the list.
  const toggleIncomeSource = (value) =>
    setF((x) => {
      if (value === NO_INCOME.value) {
        return {
          ...x,
          incomeSources: x.incomeSources.includes(NO_INCOME.value)
            ? []
            : [NO_INCOME.value],
        };
      }
      const withoutNone = x.incomeSources.filter((s) => s !== NO_INCOME.value);
      return {
        ...x,
        incomeSources: withoutNone.includes(value)
          ? withoutNone.filter((s) => s !== value)
          : [...withoutNone, value],
      };
    });

  // Changing housing status: "Sans domicile" clears the type; switching back to
  // a housed status restores a valid default when needed.
  const onHousingStatusChange = (housingStatus) => {
    setF((x) => ({
      ...x,
      housingStatus,
      housingType: !requiresHousingType(housingStatus)
        ? ""
        : x.housingType && x.housingType !== "TEMPORARY"
          ? x.housingType
          : "HOUSE",
    }));
  };

  // A household can never be smaller than its head (+ spouse when married),
  // so an empty or below-minimum value is pulled back up on blur.
  const clampMembers = () =>
    setF((x) => {
      const floor = x.maritalStatus === "MARRIED" ? 2 : 1;
      return {
        ...x,
        membersCount:
          x.membersCount === "" || Number(x.membersCount) < floor
            ? String(floor)
            : x.membersCount,
      };
    });

  // Changing marital status: when the new status has no spouse, clear the name.
  const onMaritalChange = (maritalStatus) => {
    setF((x) => ({
      ...x,
      maritalStatus,
      spouseName: NO_SPOUSE.includes(maritalStatus) ? "" : x.spouseName,
      // Marrying adds the spouse to the household; the floor follows.
      membersCount: (() => {
        const floor = maritalStatus === "MARRIED" ? 2 : 1;
        return x.membersCount === "" || Number(x.membersCount) < floor
          ? String(floor)
          : x.membersCount;
      })(),
    }));
  };

  async function submit() {
    if (!f.firstName || !f.lastName || !f.dob || !f.ccp || !f.wilaya) {
      toast(t("Veuillez remplir les champs obligatoires"), "err");
      return;
    }
    // Blocking here is what actually closes the scoring hole: without an
    // explicit answer the API would have to guess, and any guess silently
    // becomes points on the SVF score.
    if (f.incomeSources.length === 0) {
      toast(t("Veuillez indiquer les sources de revenu"), "err");
      return;
    }
    // The spouse is saved as a real family member, so the name is mandatory
    // for a married head: without it the detail view would announce 1 member
    // and then list nobody.
    if (isMarried && !f.spouseName.trim()) {
      toast(t("Veuillez indiquer le nom du conjoint"), "err");
      return;
    }
    // A housed family must say WHAT it lives in. A "Sans domicile" family is
    // exempt: for it the type is sent as null and the API stores "not
    // applicable" instead of rejecting the whole registration.
    if (!noHousing && !f.housingType) {
      toast(t("Veuillez indiquer le type de logement"), "err");
      return;
    }
    setBusy(true);
    try {
      const spouse = spouseDisabled ? "" : f.spouseName.trim();
      // Guard the same rule on submit, in case the field was never blurred.
      const membersCount =
        f.membersCount === "" || Number(f.membersCount) < minMembers
          ? String(minMembers)
          : f.membersCount;

      // The head of family and the spouse become real FamilyMember rows, so
      // the declared count and the member list in the detail popup agree.
      // The head is created here once and can never be added again later.
      const members = [
        {
          firstName: f.firstName,
          lastName: f.lastName,
          role: "HEAD",
          dateOfBirth: f.dob || undefined,
          hasDisability: f.health === "bad",
        },
      ];
      // A single-word spouse entry ("Fatima") inherits the head's family name.
      if (spouse) {
        const parts = spouse.split(/\s+/);
        members.push({
          firstName: parts[0],
          lastName: parts.length > 1 ? parts.slice(1).join(" ") : f.lastName,
          role: "SPOUSE",
        });
      }
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
        // Explicit null, not undefined: "this family has no housing type".
        housingType: noHousing ? null : f.housingType,
        monthlyIncome: f.monthlyIncome ? Number(f.monthlyIncome) : undefined,
        incomeSources: f.incomeSources,
        membersCount: Number(membersCount),
        // Stored as family details only -- see the note on EMPTY above.
        childrenSchoolCount: f.childrenSchoolCount
          ? Number(f.childrenSchoolCount)
          : undefined,
        orphanCount: f.orphanCount ? Number(f.orphanCount) : undefined,
        elderlyCount: f.elderlyCount ? Number(f.elderlyCount) : undefined,
        hasDisability: f.health === "bad",
        diseases:
          f.health === "warn" ? f.diseases || "Maladie chronique" : undefined,
        // Free text only. The spouse is a real SPOUSE member row now, so the
// name is never duplicated into the notes.
notes: f.notes || undefined,
        members,
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
          <SelectLite
            value={f.maritalStatus}
            onChange={onMaritalChange}
            options={MARITAL_STATUS.map((m) => ({
              value: m.value,
              label: t(m.label),
            }))}
          />
        </Field>
        <Field label={t("Conjoint(e)")} required={isMarried}>
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
          hint={
            isMarried
              ? t("Minimum 2 (chef + conjoint)")
              : t("Minimum 1 (chef de famille)")
          }
        >
          <input
            type="number"
            min={minMembers}
            value={f.membersCount}
            onChange={set("membersCount")}
            onBlur={clampMembers}
            placeholder={String(minMembers)}
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
        <Field
          label={t("Sources de revenu")}
          required
          full
          hint={t("Champ obligatoire pour le calcul du score SVF")}
        >
          <div className="src-grid">
            {INCOME_SOURCES.map((s) => {
              const on = f.incomeSources.includes(s.value);
              return (
                <label
                  key={s.value}
                  className={`src-chip ${on ? "on" : ""} ${
                    declaresNoIncome ? "muted" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleIncomeSource(s.value)}
                  />
                  <span className="box" aria-hidden="true" />
                  {t(s.label)}
                </label>
              );
            })}
            <label className={`src-chip none ${declaresNoIncome ? "on" : ""}`}>
              <input
                type="checkbox"
                checked={declaresNoIncome}
                onChange={() => toggleIncomeSource(NO_INCOME.value)}
              />
              <span className="box" aria-hidden="true" />
              {t(NO_INCOME.label)}
            </label>
          </div>
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
          <SelectLite
            value={f.housingStatus}
            onChange={onHousingStatusChange}
            options={HOUSING_STATUS.map((h) => ({
              value: h.value,
              label: t(h.label),
            }))}
          />
        </Field>
        <Field
          label={t("Type de logement")}
          required={!noHousing}
          hint={
            noHousing
              ? t("Non requis pour une famille sans domicile")
              : undefined
          }
        >
          <SelectLite
            value={noHousing ? "" : f.housingType}
            onChange={setV("housingType")}
            disabled={noHousing}
            placeholder={t("Non applicable")}
            options={
              noHousing
                ? [{ value: "", label: t("Non applicable") }]
                : HOUSING_TYPE_OPTIONS.map((h) => ({
                    value: h.value,
                    label: t(h.label),
                  }))
            }
          />
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