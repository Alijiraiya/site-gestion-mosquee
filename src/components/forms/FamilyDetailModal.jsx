"use client";
import { useCallback, useEffect, useState } from "react";
import { Modal, Loading, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import MemberDetailModal from "@/components/forms/MemberDetailModal";
import MemberFormModal from "@/components/forms/MemberFormModal";
import ConfirmDialog from "@/components/forms/ConfirmDialog";
import { api } from "@/lib/apiClient";
import { housingTypeApplies } from "@/lib/housing";
import {
  formatDA,
  initials,
  ageFromDate,
  maritalLabel,
  memberRoleLabel,
  healthState,
  HEALTH_COLOR,
  HEALTH_LABEL,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  HOUSING_STATUS,
  HOUSING_TYPE,
  svfPercent,
  svfColor,
} from "@/lib/format";
import { useTranslations } from "next-intl";

const DANGER = HEALTH_COLOR.bad;

const labelOf = (list, value) =>
  list.find((o) => o.value === value)?.label || null;

/**
 * Read-only popup shown when a family row is clicked. Displays the family's
 * key information and a brief list of its members. Also exposes an
 * "Add member" shortcut via onAddMember and a delete shortcut via onDelete.
 *
 * Each member rectangle is now clickable: it opens MemberDetailModal with that
 * member's full description, from where the member -- head of family included
 * -- can be edited or removed. Every one of those actions goes through the API,
 * which rescores the family, so the SVF badge at the top of this popup is
 * refreshed on the spot rather than at the next page load.
 */
export default function FamilyDetailModal({
  family,
  onClose,
  onAddMember,
  onDelete,
  onChanged,
}) {
  const t = useTranslations("App");
  const toast = useToast();
  // `family` is the row that was clicked, i.e. a snapshot of the list. The
  // family itself may have changed since then (adding a spouse promotes the
  // head to "Mari\u00e9(e)" and raises the household size), so the record is
  // re-read from the API and `fam` is what the popup displays.
  const [fam, setFam] = useState(family);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sub-popups opened from a member rectangle.
  const [viewing, setViewing] = useState(null); // member being described
  const [editing, setEditing] = useState(null); // member being edited
  const [removing, setRemoving] = useState(null); // member being deleted

  const reload = useCallback(async () => {
    const [f, d] = await Promise.all([
      api.get(`/families/${family.id}`).catch(() => null),
      api.get(`/families/${family.id}/members`).catch(() => null),
    ]);
    if (f?.family) setFam(f.family);
    if (d?.members) setMembers(d.members);
    return f?.family ?? null;
  }, [family.id]);

  useEffect(() => {
    let alive = true;
    setFam(family);
    setLoading(true);
    Promise.all([
      api.get(`/families/${family.id}`).catch(() => null),
      api.get(`/families/${family.id}/members`).catch(() => null),
    ])
      .then(([f, d]) => {
        if (!alive) return;
        if (f?.family) setFam(f.family);
        setMembers(d?.members || []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id]);

  const name = `${fam.firstName} ${fam.lastName}`;
  const hs = healthState(fam);
  const pct = svfPercent(fam.svfScore);

  // Declared household size (authoritative, from the intake form) vs the
  // members actually registered one by one. While registered < declared the
  // file is incomplete and the imam must finish filling it in.
  const declared = Math.max(1, Number(fam.membersCount ?? 1));
  const missing = Math.max(0, declared - members.length);
  const incomplete = !loading && missing > 0;

  // "Sans domicile" has no housing type: show "Non applicable" instead of the
  // neutral value stored in the database.
  const housing = [
    labelOf(HOUSING_STATUS, fam.housingStatus),
    housingTypeApplies(fam)
      ? labelOf(HOUSING_TYPE, fam.housingType)
      : "Non applicable",
  ]
    .filter(Boolean)
    .map((l) => t(l))
    .join(" \u00b7 ");

  const rows = [
    [t("Wilaya"), fam.wilaya || "\u2014"],
    [t("Adresse"), fam.address || "\u2014"],
    [t("T\u00e9l\u00e9phone"), fam.phone || "\u2014"],
    [t("Situation"), t(maritalLabel(fam.maritalStatus))],
    [t("Logement"), housing || "\u2014"],
    [t("Nombre de membres"), declared],
    [
      t("Revenu mensuel"),
      fam.monthlyIncome != null ? formatDA(fam.monthlyIncome) : "\u2014",
    ],
    [t("N\u00b0 CCP"), fam.ccp || "\u2014"],
  ];

  // After ANY member change the family record is re-read, because the API may
  // have moved three things at once: the SVF score, the marital status and the
  // household size. `onChanged` lets the families table refresh its own row.
  async function afterMemberChange(res) {
    const updated = await reload();
    onChanged?.(updated ?? fam);
    if (res?.svfScore !== null && res?.svfScore !== undefined) {
      toast(`${t("Score SVF")}: ${res.svfScore}`);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      const res = await api.del(`/members/${removing.id}`);
      toast(t("Membre supprim\u00e9"));
      setRemoving(null);
      setViewing(null);
      await afterMemberChange(res);
    } catch (e) {
      toast(e.message || t("\u00c9chec de la suppression"), "err");
    }
  }

  return (
    <>
      <Modal
        title={name}
        subtitle={t("D\u00e9tails de la famille")}
        icon="families"
        onClose={onClose}
        footer={
          <>
            <button className="btn btn-text" onClick={onClose}>
              {t("Fermer")}
            </button>
            {onDelete && (
              <button
                className="btn btn-ghost"
                style={{ color: DANGER }}
                onClick={() => onDelete({ ...fam, name })}
              >
                <Icon name="trash" size={16} /> {t("Supprimer")}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() =>
                onAddMember?.({
                  id: fam.id,
                  name,
                  lastName: fam.lastName,
                })
              }
            >
              <Icon name="plus" size={16} /> {t("Ajouter un membre")}
            </button>
          </>
        }
      >
        {/* Status chips */}
        <div className="fd-chips">
          <span
            className="pill"
            style={{
              background: HEALTH_COLOR[hs] + "28",
              color: HEALTH_COLOR[hs],
            }}
          >
            <span className="dot" style={{ background: HEALTH_COLOR[hs] }} />
            {t(HEALTH_LABEL[hs])}
          </span>
          {fam.priority && (
            <span
              className="pill"
              style={{
                background: PRIORITY_COLOR[fam.priority] + "28",
                color: PRIORITY_COLOR[fam.priority],
              }}
            >
              {t(PRIORITY_LABEL[fam.priority])}
            </span>
          )}
          <span className="fd-svf" style={{ color: svfColor(pct) }}>
            {t("Score SVF")}: <b>{pct}%</b>
          </span>
        </div>

        {/* Info grid */}
        <div className="fd-info">
          {rows.map(([k, v]) => (
            <div className="fd-row" key={k}>
              <span className="fd-key">{k}</span>
              <span className="fd-val">{v}</span>
            </div>
          ))}
        </div>

        {/* Members */}
        <div className="fd-members-head">
          {t("Membres de la famille")}
          {!loading && (
            <span className={`fd-count ${incomplete ? "warn" : ""}`}>
              {members.length}/{declared}
            </span>
          )}
        </div>

        {/* Mandatory completion notice: the declared household size is the
            reference, so every missing member still has to be registered. */}
        {incomplete && (
          <div className="fd-todo" role="alert">
            <Icon name="alert" size={16} />
            <div>
              <b>{t("Fiche incompl\u00e8te")}</b>
              <div className="fd-todo-sub">
                {missing} {t("membre(s) restant(s) \u00e0 enregistrer sur")}{" "}
                {declared}. {t("Cette \u00e9tape est obligatoire")}.
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                onAddMember?.({
                  id: fam.id,
                  name,
                  lastName: fam.lastName,
                })
              }
            >
              <Icon name="plus" size={14} /> {t("Compl\u00e9ter")}
            </button>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : members.length === 0 ? (
          <div className="fd-empty">{t("Aucun membre enregistr\u00e9")}</div>
        ) : (
          <>
            <div className="fd-hint">
              {t("Cliquez sur un membre pour voir sa fiche")}
            </div>
            <ul className="fd-members">
              {members.map((m) => {
                const mName = `${m.firstName || ""} ${m.lastName || ""}`.trim();
                const age = m.dateOfBirth ? ageFromDate(m.dateOfBirth) : null;
                return (
                  <li
                    className="fd-member clickable"
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${mName} \u2014 ${t("voir la fiche")}`}
                    onClick={() => setViewing(m)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setViewing(m);
                      }
                    }}
                  >
                    <div className="avatar sq sm">{initials(mName || "?")}</div>
                    <div className="fd-member-main">
                      <div className="fd-member-name">
                        {mName || "\u2014"}
                        {m.role === "HEAD" && (
                          <span className="fd-head-tag">{t("Chef")}</span>
                        )}
                      </div>
                      <div className="fd-member-sub">
                        {t(memberRoleLabel(m.role))}
                        {age != null && age !== "\u2014"
                          ? ` \u00b7 ${age} ${t("ans")}`
                          : ""}
                        {m.occupation ? ` \u00b7 ${m.occupation}` : ""}
                      </div>
                    </div>
                    {/* Direct shortcut, so modifying a member does not require
                        opening the description first. */}
                    <button
                      className="icon-pill fd-member-edit"
                      title={t("Modifier")}
                      aria-label={`${t("Modifier")} ${mName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(m);
                      }}
                    >
                      <Icon name="sliders" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Modal>

      {/* Description of one member */}
      {viewing && (
        <MemberDetailModal
          member={viewing}
          familyName={name}
          onClose={() => setViewing(null)}
          onEdit={(m) => {
            setViewing(null);
            setEditing(m);
          }}
          onDelete={(m) => setRemoving(m)}
        />
      )}

      {/* Edit that member (head of family included) */}
      {editing && (
        <MemberFormModal
          familyId={fam.id}
          familyName={name}
          familyLastName={fam.lastName}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={afterMemberChange}
        />
      )}

      {/* Deleting a member is irreversible and moves the score: confirm it. */}
      {removing && (
        <ConfirmDialog
          title={t("Supprimer ce membre ?")}
          message={`${removing.firstName || ""} ${removing.lastName || ""}`.trim()}
          subtitle={name}
          warning={t(
            "Le membre sera retir\u00e9 de la famille et le score SVF sera recalcul\u00e9",
          )}
          confirmLabel={t("Supprimer")}
          onClose={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}
    </>
  );
}
